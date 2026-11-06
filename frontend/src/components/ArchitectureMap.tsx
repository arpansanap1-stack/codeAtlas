"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType,
  Position,
} from "@xyflow/react";
import dagre from "dagre";
import { Search, LayoutGrid, ArrowRight, ArrowDown } from "lucide-react";
import { CustomNode, CustomNodeData } from "./CustomNode";
import { GraphData } from "@/types";

const NODE_WIDTH = 240;
const NODE_HEIGHT = 65;

const nodeTypes = {
  custom: CustomNode,
};

function getLayoutedElements(
  nodes: Node<CustomNodeData>[],
  edges: Edge[],
  direction: "LR" | "TB" = "LR"
) {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 40,
    ranksep: 90,
    marginx: 40,
    marginy: 40,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: direction === "LR" ? Position.Left : Position.Top,
      sourcePosition: direction === "LR" ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition ? nodeWithPosition.x - NODE_WIDTH / 2 : 0,
        y: nodeWithPosition ? nodeWithPosition.y - NODE_HEIGHT / 2 : 0,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

interface ArchitectureMapProps {
  graphData: GraphData;
  onSelectFile: (filePath: string) => void;
  selectedFile?: string | null;
}

function FlowCameraController({ focusId }: { focusId?: string | null }) {
  const { fitView, getNode } = useReactFlow();

  useEffect(() => {
    if (focusId) {
      const node = getNode(focusId);
      if (node) {
        fitView({
          nodes: [{ id: focusId }],
          duration: 600,
          padding: 0.8,
          maxZoom: 1.2,
        });
      }
    }
  }, [focusId, fitView, getNode]);

  return null;
}

export function ArchitectureMap({
  graphData,
  onSelectFile,
  selectedFile,
}: ArchitectureMapProps) {
  return (
    <ReactFlowProvider>
      <ArchitectureMapInner
        graphData={graphData}
        onSelectFile={onSelectFile}
        selectedFile={selectedFile}
      />
    </ReactFlowProvider>
  );
}

function ArchitectureMapInner({
  graphData,
  onSelectFile,
  selectedFile,
}: ArchitectureMapProps) {
  const [direction, setDirection] = useState<"LR" | "TB">("LR");
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Convert raw GraphData to React Flow Nodes & Edges
  const initialElements = useMemo(() => {
    const rawNodes: Node<CustomNodeData>[] = graphData.nodes.map((n) => ({
      id: n.id,
      type: "custom",
      data: {
        id: n.id,
        label: n.label,
        folder: n.folder,
        in_degree: n.in_degree,
        out_degree: n.out_degree,
        summary: n.summary,
      },
      position: { x: 0, y: 0 },
    }));

    const rawEdges: Edge[] = graphData.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "smoothstep",
      animated: false,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 14,
        height: 14,
        color: "#52525b",
      },
      style: { stroke: "#3f3f46", strokeWidth: 1.5 },
    }));

    return getLayoutedElements(rawNodes, rawEdges, direction);
  }, [graphData, direction]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialElements.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialElements.edges);

  useEffect(() => {
    const layouted = getLayoutedElements(initialElements.nodes, initialElements.edges, direction);
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
  }, [direction, initialElements, setNodes, setEdges]);

  // Handle Search Filtering & Connected Nodes Highlighting
  const activeFocusId = hoveredNodeId || selectedFile;

  const connectedNodeIds = useMemo(() => {
    if (!activeFocusId) return null;
    const connected = new Set<string>([activeFocusId]);
    edges.forEach((edge) => {
      if (edge.source === activeFocusId) connected.add(edge.target);
      if (edge.target === activeFocusId) connected.add(edge.source);
    });
    return connected;
  }, [activeFocusId, edges]);

  // Apply Dimming / Highlighting state to nodes
  const displayNodes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return nodes.map((node) => {
      let isDimmed = false;

      // 1. Search Query filter
      if (query) {
        const matchesLabel = node.data.label.toLowerCase().includes(query);
        const matchesFolder = node.data.folder.toLowerCase().includes(query);
        if (!matchesLabel && !matchesFolder) {
          isDimmed = true;
        }
      }

      // 2. Focus connected filter
      if (!isDimmed && connectedNodeIds && !connectedNodeIds.has(node.id)) {
        isDimmed = true;
      }

      return {
        ...node,
        selected: node.id === selectedFile,
        data: {
          ...node.data,
          isDimmed,
        },
      };
    });
  }, [nodes, searchQuery, connectedNodeIds, selectedFile]);

  // Apply Highlights to Edges
  const displayEdges = useMemo(() => {
    return edges.map((edge) => {
      const isConnected =
        activeFocusId &&
        (edge.source === activeFocusId || edge.target === activeFocusId);

      return {
        ...edge,
        animated: !!isConnected,
        style: {
          stroke: isConnected ? "#38bdf8" : "#3f3f46",
          strokeWidth: isConnected ? 2.5 : 1.5,
          opacity: activeFocusId ? (isConnected ? 1 : 0.15) : 0.7,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isConnected ? "#38bdf8" : "#52525b",
        },
      };
    });
  }, [edges, activeFocusId]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelectFile(node.id);
    },
    [onSelectFile]
  );

  const onNodeMouseEnter = useCallback((_: React.MouseEvent, node: Node) => {
    setHoveredNodeId(node.id);
  }, []);

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  return (
    <div className="relative w-full h-full bg-zinc-950 overflow-hidden select-none">
      {/* Floating Toolbar: Search & Layout Direction Toggle */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-zinc-900/90 backdrop-blur-md p-1.5 rounded-lg border border-zinc-800 shadow-xl">
        {/* Search Input */}
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search modules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-48 bg-zinc-950/80 border border-zinc-800 rounded-md pl-8 pr-3 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
          />
        </div>

        <div className="h-4 w-[1px] bg-zinc-800" />

        {/* Direction Toggle */}
        <button
          onClick={() => setDirection((d) => (d === "LR" ? "TB" : "LR"))}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono text-zinc-300 hover:text-white bg-zinc-800/80 hover:bg-zinc-700/80 rounded transition-colors"
          title={`Switch to ${direction === "LR" ? "Top-to-Bottom" : "Left-to-Right"} Layout`}
        >
          {direction === "LR" ? (
            <>
              <ArrowRight className="w-3 h-3 text-sky-400" />
              <span>LR Layout</span>
            </>
          ) : (
            <>
              <ArrowDown className="w-3 h-3 text-emerald-400" />
              <span>TB Layout</span>
            </>
          )}
        </button>
      </div>

      {/* Main Flow Canvas */}
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        className="bg-zinc-950"
      >
        <FlowCameraController focusId={selectedFile} />
        <Background color="#27272a" gap={20} size={1} />
        <Controls className="!bottom-4 !left-4" />
        <MiniMap
          nodeColor={(n) => {
            if (n.data?.isDimmed) return "#27272a";
            return "#3f3f46";
          }}
          maskColor="rgba(9, 9, 11, 0.75)"
          className="!bottom-4 !right-4 !bg-zinc-900 !border !border-zinc-800 !rounded-lg"
        />
      </ReactFlow>
    </div>
  );
}

