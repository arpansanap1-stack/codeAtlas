import { useEffect } from "react";
import { Node, Edge, Position, useReactFlow } from "@xyflow/react";
import dagre from "dagre";
import { CustomNodeData } from "@/components/CustomNode";

export const NODE_WIDTH = 240;
export const NODE_HEIGHT = 65;

export function getLayoutedElements(
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

export function FlowCameraController({ focusId }: { focusId?: string | null }) {
  const { fitView, getNode } = useReactFlow();

  useEffect(() => {
    if (focusId) {
      const node = getNode(focusId);
      if (node) {
        fitView({
          nodes: [{ id: focusId }],
          duration: 600,
          padding: 0.5,
          maxZoom: 1.2,
        });
      }
    }
  }, [focusId, fitView, getNode]);

  return null;
}
