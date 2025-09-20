"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "reactflow";

import type { PlanFormEvent } from "@/lib/types/planning";

import "reactflow/dist/style.css";

interface EventGraphEditorProps {
  events: PlanFormEvent[];
  onUpdateDependency: (targetId: string, sourceId: string | null) => void;
}

const NODE_HORIZONTAL_GAP = 240;
const NODE_VERTICAL_GAP = 180;
const STAGE_WIDTH = 3;

export function EventGraphEditor({
  events,
  onUpdateDependency,
}: EventGraphEditorProps) {
  const initialNodes = useMemo(() => generateNodes(events), [events]);
  const initialEdges = useMemo(() => generateEdges(events), [events]);

  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialEdges, initialNodes]);

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

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="h-[320px] w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          fitView
        >
          <MiniMap pannable zoomable />
          <Controls position="top-left" showInteractive={false} />
          <Background gap={16} />
        </ReactFlow>
      </div>
    </div>
  );
}

const generateNodes = (events: PlanFormEvent[]): Node[] =>
  events.map((event, index) => {
    const row = Math.floor(index / STAGE_WIDTH);
    const column = index % STAGE_WIDTH;
    return {
      id: event.id,
      data: { label: event.name || event.id },
      position: {
        x: column * NODE_HORIZONTAL_GAP,
        y: row * NODE_VERTICAL_GAP,
      },
    } satisfies Node;
  });

const generateEdges = (events: PlanFormEvent[]): Edge[] =>
  events
    .filter((event) => Boolean(event.precedingEventId))
    .map((event) => ({
      id: `${event.precedingEventId}->${event.id}`,
      source: event.precedingEventId as string,
      target: event.id,
      animated: true,
    }));
