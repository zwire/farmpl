"use client";

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  type Connection,
  Controls,
  type Edge,
  type EdgeChange,
  MarkerType,
  type Node,
  type NodeChange,
  ReactFlow,
} from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { PlanUiEvent } from "@/lib/domain/planning-ui-types";

import "@xyflow/react/dist/style.css";

interface EventGraphEditorProps {
  events: PlanUiEvent[];
  selectedEventId?: string | null;
  onSelectEvent?: (eventId: string | null) => void;
  onUpdateDependency: (targetId: string, sourceId: string | null) => void;
  onRemoveEvent?: (eventId: string) => void;
}

const NODE_HORIZONTAL_GAP = 240;
const NODE_VERTICAL_GAP = 180;
const STAGE_WIDTH = 3;

export function EventGraphEditor({
  events,
  selectedEventId,
  onSelectEvent,
  onUpdateDependency,
  onRemoveEvent,
}: EventGraphEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [nodes, setNodes] = useState<Node[]>(() =>
    generateNodes(events, selectedEventId ?? null),
  );
  const [edges, setEdges] = useState<Edge[]>(() => generateEdges(events));
  const lastSelectedRef = useRef<string | null>(selectedEventId ?? null);

  useEffect(() => {
    if (lastSelectedRef.current === selectedEventId) {
      return;
    }
    if (!containerRef.current) {
      return;
    }
    const { clientWidth: width, clientHeight: height } = containerRef.current;
    const centerPosition = { x: width / 4, y: height / 4 };
    setNodes((current) =>
      syncNodes(current, events, selectedEventId ?? null, centerPosition),
    );
  }, [events, selectedEventId]);

  useEffect(() => {
    setEdges((current) => syncEdges(current, events));
  }, [events]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((current) => applyEdgeChanges(changes, current));
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      setEdges((current) => addEdge(connection, current));
      onUpdateDependency(connection.target, connection.source);
    },
    [onUpdateDependency],
  );

  const onEdgesDelete = useCallback(
    (edgesToDelete: Edge[]) => {
      edgesToDelete.forEach((edge) => {
        onUpdateDependency(edge.target, null);
      });
    },
    [onUpdateDependency],
  );

  const onNodesDelete = useCallback(
    (nodesToDelete: Node[]) => {
      nodesToDelete.forEach((node) => {
        onRemoveEvent?.(node.id);
      });
    },
    [onRemoveEvent],
  );

  const handleSelectionChange = useCallback(
    (selection: { nodes?: Node[] } | null) => {
      const newSelectedId = selection?.nodes?.[0]?.id ?? null;
      if (lastSelectedRef.current !== newSelectedId) {
        lastSelectedRef.current = newSelectedId;
        onSelectEvent?.(newSelectedId);
      }
    },
    [onSelectEvent],
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div ref={containerRef} className="h-[320px] w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onSelectionChange={handleSelectionChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          onNodesDelete={onNodesDelete}
          deleteKeyCode={["Delete", "Backspace"]}
          panOnScroll
          selectionOnDrag
          fitView
        >
          <Controls position="top-left" showInteractive={false} />
          <Background gap={16} />
        </ReactFlow>
      </div>
    </div>
  );
}

const generateNodes = (
  events: PlanUiEvent[],
  selectedId: string | null,
  centerPosition?: { x: number; y: number } | null,
): Node[] =>
  events.map((event, index) => {
    const row = Math.floor(index / STAGE_WIDTH);
    const column = index % STAGE_WIDTH;
    return {
      id: event.id,
      data: { label: event.name || event.id },
      position: centerPosition ?? {
        x: column * NODE_HORIZONTAL_GAP,
        y: row * NODE_VERTICAL_GAP,
      },
      selected: event.id === selectedId,
    } satisfies Node;
  });

const generateEdges = (events: PlanUiEvent[]): Edge[] =>
  events
    .filter((event) => Boolean(event.precedingEventId))
    .map((event) => ({
      id: `${event.precedingEventId}->${event.id}`,
      source: event.precedingEventId as string,
      target: event.id,
      animated: true,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
      },
      label: createLagLabel(event.lag),
      labelBgPadding: [6, 2],
      labelBgBorderRadius: 4,
      labelBgStyle: { fill: "#ffffff", stroke: "#cbd5f5" },
      labelStyle: { fontSize: 11, fill: "#0f172a" },
    }));

const syncNodes = (
  current: Node[],
  events: PlanUiEvent[],
  selectedId: string | null,
  centerPosition: { x: number; y: number } | null,
): Node[] => {
  const byId = new Map(current.map((node) => [node.id, node] as const));

  return events.map((event, index) => {
    const existing = byId.get(event.id);
    if (existing) {
      return {
        ...existing,
        data: { label: event.name || event.id },
        selected: event.id === selectedId,
      } satisfies Node;
    }
    const row = Math.floor(index / STAGE_WIDTH);
    const column = index % STAGE_WIDTH;
    return {
      id: event.id,
      data: { label: event.name || event.id },
      position: centerPosition ?? {
        x: column * NODE_HORIZONTAL_GAP,
        y: row * NODE_VERTICAL_GAP,
      },
      selected: event.id === selectedId,
    } satisfies Node;
  });
};

const createLagLabel = (
  lag: PlanUiEvent["lag"] | undefined,
): string | undefined => {
  if (!lag) return undefined;
  const parts: string[] = [];
  if (typeof lag.min === "number") {
    parts.push(`${lag.min}日以上`);
  }
  if (typeof lag.max === "number") {
    parts.push(`${lag.max}日以内`);
  }
  return parts.length > 0 ? parts.join(" ") : undefined;
};

const syncEdges = (current: Edge[], events: PlanUiEvent[]): Edge[] => {
  const set = new Set(current.map((edge) => edge.id));
  const updated = generateEdges(events);
  if (
    updated.length === current.length &&
    updated.every((edge) => set.has(edge.id))
  ) {
    return updated.map((edge) => ({
      ...edge,
      markerEnd: edge.markerEnd,
    }));
  }
  return updated;
};
