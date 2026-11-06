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
import { GraphData, JourneyStep } from "@/types";

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
  activeJourneySteps?: JourneyStep[] | null;
  currentJourneyStepIndex?: number;
  impactAffectedNodeIds?: string[] | null;
  impactTargetFile?: string | null;
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
  activeJourneySteps,
  currentJourneyStepIndex,
  impactAffectedNodeIds,
  impactTargetFile,
}: ArchitectureMapProps) {
  return (
    <ReactFlowProvider>
      <ArchitectureMapInner
        graphData={graphData}
        onSelectFile={onSelectFile}
        selectedFile={selectedFile}
        activeJourneySteps={activeJourneySteps}
        currentJourneyStepIndex={currentJourneyStepIndex}
        impactAffectedNodeIds={impactAffectedNodeIds}
        impactTargetFile={impactTargetFile}
      />
    </ReactFlowProvider>
  );
}

function ArchitectureMapInner({
  graphData,
  onSelectFile,
  selectedFile,
  activeJourneySteps,
  currentJourneyStepIndex,
  impactAffectedNodeIds,
  impactTargetFile,
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

    const journeyStepMap = new Map<string, number>();
    if (activeJourneySteps && activeJourneySteps.length > 0) {
      activeJourneySteps.forEach((s) => {
        journeyStepMap.set(s.file_path, s.step_number);
      });
    }

    const impactSet = new Set(impactAffectedNodeIds || []);
    const hasImpactActive = !!(impactTargetFile || (impactAffectedNodeIds && impactAffectedNodeIds.length > 0));

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

      // 2. Impact Blast Radius filter
      if (hasImpactActive) {
        if (node.id !== impactTargetFile && !impactSet.has(node.id)) {
          isDimmed = true;
        }
      }
      // 3. Journey filter: If journey is active, dim nodes that are not in the journey
      else if (activeJourneySteps && activeJourneySteps.length > 0) {
        if (!journeyStepMap.has(node.id)) {
          isDimmed = true;
        }
      } else if (!isDimmed && connectedNodeIds && !connectedNodeIds.has(node.id)) {
        // 4. Focus connected filter
        isDimmed = true;
      }

      const stepNum = journeyStepMap.get(node.id);
      const isTarget = node.id === impactTargetFile;
      const isAffected = impactSet.has(node.id);

      return {
        ...node,
        selected: node.id === selectedFile,
        data: {
          ...node.data,
          isDimmed,
          journeyStepNumber: stepNum,
          isImpactTarget: isTarget,
          isImpactAffected: isAffected,
        },
      };
    });
  }, [nodes, searchQuery, connectedNodeIds, selectedFile, activeJourneySteps, impactAffectedNodeIds, impactTargetFile]);

  // Apply Highlights to Edges
  const displayEdges = useMemo(() => {
    const journeyEdges = new Set<string>();
    if (activeJourneySteps && activeJourneySteps.length > 1) {
      for (let i = 0; i < activeJourneySteps.length - 1; i++) {
        const src = activeJourneySteps[i].file_path;
        const tgt = activeJourneySteps[i + 1].file_path;
        journeyEdges.add(`${src}->${tgt}`);
      }
    }

    const impactSet = new Set(impactAffectedNodeIds || []);

    return edges.map((edge) => {
      const isJourneyEdge =
        journeyEdges.has(`${edge.source}->${edge.target}`) ||
        journeyEdges.has(edge.id);

      const isImpactEdge =
        impactTargetFile &&
        (edge.target === impactTargetFile || edge.source === impactTargetFile || impactSet.has(edge.source) || impactSet.has(edge.target));

      const isConnected =
        activeFocusId &&
        (edge.source === activeFocusId || edge.target === activeFocusId);

      const isHighlighted = isJourneyEdge || isImpactEdge || isConnected;

      return {
        ...edge,
        animated: !!isHighlighted,
        style: {
          stroke: isImpactEdge ? "#f59e0b" : isJourneyEdge ? "#38bdf8" : isConnected ? "#38bdf8" : "#3f3f46",
          strokeWidth: isImpactEdge ? 2.5 : isJourneyEdge ? 3 : isConnected ? 2.5 : 1.5,
          opacity:
            (impactAffectedNodeIds && impactAffectedNodeIds.length > 0)
              ? isImpactEdge
                ? 1
                : 0.12
              : activeJourneySteps && activeJourneySteps.length > 0
              ? isJourneyEdge
                ? 1
                : 0.12
              : activeFocusId
              ? isConnected
                ? 1
                : 0.15
              : 0.7,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isImpactEdge ? "#f59e0b" : isHighlighted ? "#38bdf8" : "#52525b",
        },
      };
    });
  }, [edges, activeFocusId, activeJourneySteps, impactAffectedNodeIds, impactTargetFile]);

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
      {/* Floating Toolbar: Search, Category Filters & Layout Direction */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2 bg-panel/95 backdrop-blur-md p-1.5 rounded-xl border border-borderDefault shadow-elevated">
        {/* Search Input */}
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search modules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-44 md:w-52 bg-surface border border-borderSubtle rounded-lg pl-8 pr-3 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-borderFocus font-sans transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 text-zinc-500 hover:text-zinc-300 text-xs"
            >
              ×
            </button>
          )}
        </div>

        <div className="h-4 w-[1px] bg-borderSubtle" />

        {/* Direction Toggle */}
        <button
          onClick={() => setDirection((d) => (d === "LR" ? "TB" : "LR"))}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono text-zinc-300 hover:text-white bg-surface hover:bg-surfaceHover border border-borderSubtle rounded-lg transition-colors cursor-pointer"
          title={`Switch to ${direction === "LR" ? "Top-to-Bottom" : "Left-to-Right"} Layout`}
        >
          {direction === "LR" ? (
            <>
              <ArrowRight className="w-3 h-3 text-accent-indigoLight" />
              <span>Left → Right</span>
            </>
          ) : (
            <>
              <ArrowDown className="w-3 h-3 text-accent-emerald" />
              <span>Top → Down</span>
            </>
          )}
        </button>

        {/* Node stats / Category badges */}
        <div className="hidden lg:flex items-center gap-1.5 pl-1 text-[10px] font-mono text-zinc-400">
          <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            UI
          </span>
          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            Services
          </span>
          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20">
            Models
          </span>
          <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20">
            Utils
          </span>
        </div>
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
        className="bg-workspace"
      >
        <FlowCameraController focusId={selectedFile} />
        <Background color="#1f2533" gap={24} size={1} />
        <Controls className="!bottom-4 !left-4" />
        <MiniMap
          nodeColor={(n) => {
            if (n.data?.isDimmed) return "#1e2430";
            return "#4f46e5";
          }}
          maskColor="rgba(12, 14, 20, 0.85)"
          className="!bottom-4 !right-4 !bg-panel !border !border-borderDefault !rounded-xl overflow-hidden shadow-card"
        />
      </ReactFlow>
    </div>
  );
}

