"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType,
} from "@xyflow/react";
import { CustomNode, CustomNodeData } from "./CustomNode";
import { GraphData, JourneyStep } from "@/types";
import {
  FlowCameraController,
  getLayoutedElements,
} from "@/components/map/mapLayoutUtils";
import { MapControlsBar } from "@/components/map/MapControlsBar";

const nodeTypes = {
  custom: CustomNode,
};

interface ArchitectureMapProps {
  graphData: GraphData;
  onSelectFile: (filePath: string) => void;
  selectedFile?: string | null;
  activeJourneySteps?: JourneyStep[] | null;
  currentJourneyStepIndex?: number;
  impactAffectedNodeIds?: string[] | null;
  impactTargetFile?: string | null;
}

export function ArchitectureMap(props: ArchitectureMapProps) {
  return (
    <ReactFlowProvider>
      <ArchitectureMapInner {...props} />
    </ReactFlowProvider>
  );
}

function ArchitectureMapInner({
  graphData,
  onSelectFile,
  selectedFile,
  activeJourneySteps,
  currentJourneyStepIndex = 0,
  impactAffectedNodeIds,
  impactTargetFile,
}: ArchitectureMapProps) {
  const [direction, setDirection] = useState<"LR" | "TB">("LR");
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const initialElements = useMemo(() => {
    const rawNodes: Node<CustomNodeData>[] = graphData.nodes.map((node) => ({
      id: node.id,
      type: "custom",
      data: {
        id: node.id,
        label: node.label,
        folder: node.folder,
        in_degree: node.in_degree,
        out_degree: node.out_degree,
        summary: node.summary,
      },
      position: { x: 0, y: 0 },
    }));

    const rawEdges: Edge[] = graphData.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      animated: false,
      style: { stroke: "#3f3f46", strokeWidth: 1.5 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "#3f3f46",
      },
    }));

    return getLayoutedElements(rawNodes, rawEdges, direction);
  }, [graphData, direction]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialElements.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialElements.edges);

  useEffect(() => {
    setNodes(initialElements.nodes);
    setEdges(initialElements.edges);
  }, [initialElements, setNodes, setEdges]);

  const activeFocusId = selectedFile || hoveredNodeId;

  // Compute active journey highlighting
  const journeyHighlights = useMemo(() => {
    if (!activeJourneySteps || activeJourneySteps.length === 0) return null;
    const currentStep = activeJourneySteps[currentJourneyStepIndex];
    const highlightedNodeIds = new Set(activeJourneySteps.map((s) => s.file_path));
    const activeEdgeSources = new Set<string>();

    activeJourneySteps.forEach((s) => {
      if (s.outgoing_target) {
        activeEdgeSources.add(`${s.file_path}->${s.outgoing_target}`);
      }
    });

    return {
      currentNodeId: currentStep?.file_path,
      allStepNodeIds: highlightedNodeIds,
      activeEdges: activeEdgeSources,
      stepNumber: currentStep?.step_number,
    };
  }, [activeJourneySteps, currentJourneyStepIndex]);

  // Compute decorated nodes
  const displayNodes = useMemo(() => {
    return nodes.map((node) => {
      const isSelected = node.id === selectedFile;
      const isHovered = node.id === hoveredNodeId;
      const matchesSearch = searchQuery
        ? node.id.toLowerCase().includes(searchQuery.toLowerCase())
        : true;

      const isCurrentJourneyStep = journeyHighlights?.currentNodeId === node.id;
      const isInJourney = journeyHighlights?.allStepNodeIds.has(node.id);

      const isImpactTarget = impactTargetFile === node.id;
      const isImpactAffected = impactAffectedNodeIds?.includes(node.id);

      const hasActiveFocus = Boolean(
        activeFocusId ||
          searchQuery ||
          journeyHighlights ||
          impactAffectedNodeIds ||
          impactTargetFile
      );

      const isRelevant =
        matchesSearch &&
        (journeyHighlights
          ? isInJourney
          : impactAffectedNodeIds || impactTargetFile
          ? isImpactTarget || isImpactAffected
          : activeFocusId
          ? isSelected || isHovered
          : true);

      return {
        ...node,
        data: {
          ...node.data,
          isSelected,
          isHovered,
          isCurrentJourneyStep,
          isInJourney,
          journeyStepNumber: isCurrentJourneyStep
            ? journeyHighlights?.stepNumber
            : undefined,
          isImpactTarget,
          isImpactAffected,
          isDimmed: hasActiveFocus && !isRelevant,
        },
      };
    });
  }, [
    nodes,
    selectedFile,
    hoveredNodeId,
    searchQuery,
    journeyHighlights,
    impactAffectedNodeIds,
    impactTargetFile,
    activeFocusId,
  ]);

  // Compute decorated edges
  const displayEdges = useMemo(() => {
    return edges.map((edge) => {
      const isHighlighted =
        edge.source === activeFocusId || edge.target === activeFocusId;
      const isJourneyEdge =
        journeyHighlights?.activeEdges.has(`${edge.source}->${edge.target}`);
      const isImpactEdge =
        impactAffectedNodeIds?.includes(edge.source) &&
        (edge.target === impactTargetFile ||
          impactAffectedNodeIds.includes(edge.target));

      return {
        ...edge,
        animated: Boolean(isJourneyEdge || isImpactEdge),
        style: {
          stroke: isImpactEdge
            ? "#f59e0b"
            : isJourneyEdge
            ? "#10b981"
            : isHighlighted
            ? "#38bdf8"
            : "#3f3f46",
          strokeWidth: isJourneyEdge || isImpactEdge || isHighlighted ? 2.5 : 1.2,
          opacity:
            activeFocusId ||
            journeyHighlights ||
            impactAffectedNodeIds ||
            impactTargetFile
              ? isJourneyEdge || isImpactEdge || isHighlighted
                ? 1
                : 0.15
              : 0.7,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isImpactEdge
            ? "#f59e0b"
            : isJourneyEdge
            ? "#10b981"
            : isHighlighted
            ? "#38bdf8"
            : "#52525b",
        },
      };
    });
  }, [
    edges,
    activeFocusId,
    journeyHighlights,
    impactAffectedNodeIds,
    impactTargetFile,
  ]);

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
      <MapControlsBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        direction={direction}
        onToggleDirection={() => setDirection((d) => (d === "LR" ? "TB" : "LR"))}
      />

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
        <Background color="#27272a" gap={24} size={1} />
        <Controls className="!bottom-4 !left-4" />
        <MiniMap
          nodeColor={(n) => {
            if (n.data?.isDimmed) return "#18181b";
            return "#0284c7";
          }}
          maskColor="rgba(9, 9, 11, 0.85)"
          className="!bottom-4 !right-4 !bg-zinc-900 !border !border-zinc-800 !rounded-xl overflow-hidden shadow-2xl"
        />
      </ReactFlow>
    </div>
  );
}
