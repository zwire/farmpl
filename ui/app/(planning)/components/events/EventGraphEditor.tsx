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
const DEFAULT_NODE_STYLE = {
  borderRadius: "0.5rem",
  borderWidth: 2,
  background: "white",
  boxShadow:
    "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
} as const;
const SELECTED_BORDER_COLOR = "#0ea5e9";
const UNSELECTED_BORDER_COLOR = "transparent";

export function EventGraphEditor({
  events,
  selectedEventId,
  onSelectEvent,
  onUpdateDependency,
  onRemoveEvent,
}: EventGraphEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectionSyncingRef = useRef(false);
  const [nodes, setNodes] = useState<Node[]>(() =>
    generateNodes(events, selectedEventId ?? null),
  );
  const [edges, setEdges] = useState<Edge[]>(() => generateEdges(events));

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    const { clientWidth: width, clientHeight: height } = containerRef.current;
    const centerPosition = { x: width / 4, y: height / 4 };
    selectionSyncingRef.current = true;
    setNodes((current) =>
      syncNodes(current, events, selectedEventId ?? null, centerPosition),
    );
    void Promise.resolve().then(() => {
      selectionSyncingRef.current = false;
    });
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
      if (selectionSyncingRef.current) return;
      const newSelectedId = selection?.nodes?.[0]?.id;
      if (!newSelectedId) return;
      if (selectedEventId !== newSelectedId) {
        onSelectEvent?.(newSelectedId);
      }
    },
    [onSelectEvent, selectedEventId],
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/20">
      <div ref={containerRef} className="h-[320px] w-full rounded-xl">
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
    const isSelected = event.id === selectedId;
    return {
      id: event.id,
      data: { label: event.name || event.id },
      position: centerPosition ?? {
        x: column * NODE_HORIZONTAL_GAP,
        y: row * NODE_VERTICAL_GAP,
      },
      selected: isSelected,
      style: {
        ...DEFAULT_NODE_STYLE,
        borderColor: isSelected ? SELECTED_BORDER_COLOR : UNSELECTED_BORDER_COLOR,
      },
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
      style: { stroke: "#94a3b8", strokeWidth: 1.5 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
        color: "#94a3b8",
      },
      label: createLagLabel(event.lag),
      labelBgPadding: [6, 3],
      labelBgBorderRadius: 6,
      labelBgStyle: {
        fill: "#f1f5f9",
        stroke: "#e2e8f0",
        fillOpacity: 0.9,
      },
      labelStyle: { fontSize: 11, fill: "#475569", fontWeight: 600 },
    }));

const syncNodes = (
  current: Node[],
  events: PlanUiEvent[],
  selectedId: string | null,
  centerPosition: { x: number; y: number } | null,
): Node[] => {
  const byId = new Map(current.map((node) => [node.id, node] as const));
  let hasChanged = current.length !== events.length;

  const nextNodes = events.map((event, index) => {
    const existing = byId.get(event.id);
    const isSelected = event.id === selectedId;
    const label = event.name || event.id;
    if (existing) {
      const previousBorderColor =
        typeof existing.style?.borderColor === "string"
          ? existing.style.borderColor
          : undefined;
      const nextBorderColor = isSelected
        ? SELECTED_BORDER_COLOR
        : UNSELECTED_BORDER_COLOR;
      const needsLabelUpdate = existing.data?.label !== label;
      const needsSelectedUpdate = existing.selected !== isSelected;
      const needsBorderUpdate = previousBorderColor !== nextBorderColor;
      if (needsLabelUpdate || needsSelectedUpdate || needsBorderUpdate) {
        hasChanged = true;
        return {
          ...existing,
          data: { ...existing.data, label },
          selected: isSelected,
          style: {
            ...DEFAULT_NODE_STYLE,
            ...existing.style,
            borderColor: nextBorderColor,
          },
        } satisfies Node;
      }
      return existing;
    }
    hasChanged = true;
    const row = Math.floor(index / STAGE_WIDTH);
    const column = index % STAGE_WIDTH;
    return {
      id: event.id,
      data: { label },
      position: centerPosition ?? {
        x: column * NODE_HORIZONTAL_GAP,
        y: row * NODE_VERTICAL_GAP,
      },
      selected: isSelected,
      style: {
        ...DEFAULT_NODE_STYLE,
        borderColor: isSelected ? SELECTED_BORDER_COLOR : UNSELECTED_BORDER_COLOR,
      },
    } satisfies Node;
  });

  return hasChanged ? nextNodes : current;
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
