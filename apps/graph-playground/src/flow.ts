import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { MaterializedJourneyGraph } from "@jourg/graph";

export interface JourneyFlowNodeData extends Record<string, unknown> {
  label: string;
  kind: "State" | "CompositeState";
  tags: string[];
  membership: "member" | "referenced";
  isStartState: boolean;
  subjourneyId?: string;
  source: string;
}

export type JourneyFlowNode = Node<JourneyFlowNodeData, "journeyNode">;
export type JourneyFlowEdge = Edge;

export function createFlowGraph(graph: MaterializedJourneyGraph): {
  nodes: JourneyFlowNode[];
  edges: JourneyFlowEdge[];
} {
  const depthMap = computeDepths(graph);
  const grouped = new Map<number, typeof graph.nodes>();

  for (const node of graph.nodes) {
    const depth = depthMap.get(node.id) ?? 0;
    const bucket = grouped.get(depth) ?? [];
    bucket.push(node);
    grouped.set(depth, bucket);
  }

  const nodes = Array.from(grouped.entries())
    .sort(([left], [right]) => left - right)
    .flatMap(([depth, bucket]) =>
      bucket
        .sort((left, right) => left.label.localeCompare(right.label))
        .map<JourneyFlowNode>((node, index) => ({
          id: node.id,
          type: "journeyNode",
          position: {
            x: depth * 320,
            y: index * 190
          },
          data: {
            label: node.label,
            kind: node.type,
            tags: node.tags,
            membership: node.membership,
            isStartState: node.isStartState,
            subjourneyId: node.subjourneyId,
            source: node.source
          }
        }))
    );

  const edges = graph.edges.map<JourneyFlowEdge>((edge) => ({
    id: edge.id,
    source: edge.from,
    target: edge.to,
    label: edge.label ?? edge.kind,
    animated: edge.kind !== "explicit",
    markerEnd: { type: MarkerType.ArrowClosed },
    style:
      edge.kind === "injected"
        ? { stroke: "#6d8899", strokeDasharray: "7 5", strokeWidth: 1.9 }
        : edge.kind === "mixed"
          ? { stroke: "#0e6f59", strokeWidth: 2.6 }
          : { stroke: "#234d77", strokeWidth: 2.2 },
    labelStyle: {
      fill: "#243447",
      fontSize: 11,
      fontFamily: "\"IBM Plex Mono\", monospace"
    },
    labelBgStyle: {
      fill: "rgba(255, 251, 245, 0.95)"
    },
    labelBgPadding: [8, 4],
    labelBgBorderRadius: 8,
    type: "smoothstep"
  }));

  return { nodes, edges };
}

function computeDepths(graph: MaterializedJourneyGraph): Map<string, number> {
  const adjacency = new Map<string, string[]>();
  const depths = new Map<string, number>();
  const queue: string[] = [];
  const startNode = graph.nodes.find((node) => node.isStartState) ?? graph.nodes[0];

  if (startNode) {
    depths.set(startNode.id, 0);
    queue.push(startNode.id);
  }

  for (const edge of graph.edges) {
    const bucket = adjacency.get(edge.from) ?? [];
    bucket.push(edge.to);
    adjacency.set(edge.from, bucket);
  }

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) {
      continue;
    }

    const currentDepth = depths.get(current) ?? 0;

    for (const target of adjacency.get(current) ?? []) {
      if (depths.has(target)) {
        continue;
      }

      depths.set(target, currentDepth + 1);
      queue.push(target);
    }
  }

  let fallbackDepth = depths.size > 0 ? Math.max(...depths.values()) + 1 : 0;

  for (const node of graph.nodes) {
    if (depths.has(node.id)) {
      continue;
    }

    depths.set(node.id, fallbackDepth);
    fallbackDepth += 1;
  }

  return depths;
}
