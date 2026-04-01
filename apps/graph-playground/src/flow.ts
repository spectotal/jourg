import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type {
  CompositeStateEntity,
  GraphIR,
  GraphIRJourney,
  StateEntity
} from "@jourg/graph";

export type NodeMatchState = "neutral" | "matched" | "dimmed";

export interface JourneyFlowNodeData extends Record<string, unknown> {
  nodeId: string;
  label: string;
  kind: "State" | "CompositeState";
  tags: string[];
  membership: "member" | "referenced";
  isStartState: boolean;
  subjourneyId?: string;
  source: string;
  matchState: NodeMatchState;
}

export type JourneyFlowNode = Node<JourneyFlowNodeData, "journeyNode">;
export type JourneyFlowEdge = Edge;

export function createFlowGraph(
  graph: GraphIR,
  journey: GraphIRJourney,
  options: {
    query?: string;
  } = {}
): {
  nodes: JourneyFlowNode[];
  edges: JourneyFlowEdge[];
} {
  const normalizedQuery = options.query?.trim().toLowerCase() ?? "";
  const renderableNodes = buildRenderableNodes(graph, journey);
  const depthMap = computeDepths(renderableNodes, journey);
  const grouped = new Map<number, typeof renderableNodes>();
  const matchIds = new Set<string>();

  if (normalizedQuery.length > 0) {
    for (const node of renderableNodes) {
      if (matchesNode(node, normalizedQuery)) {
        matchIds.add(node.id);
      }
    }
  }

  const hasActiveMatches = normalizedQuery.length > 0 && matchIds.size > 0;

  for (const node of renderableNodes) {
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
            x: depth * 360,
            y: index * 226
          },
          data: {
            nodeId: node.id,
            label: node.label,
            kind: node.type,
            tags: node.tags,
            membership: node.membership,
            isStartState: node.isStartState,
            subjourneyId: node.subjourneyId,
            source: node.source,
            matchState: getMatchState(node.id, hasActiveMatches, matchIds)
          }
        }))
    );

  const edges = journey.edges.map<JourneyFlowEdge>((edge) => {
    const stroke =
      edge.kind === "mixed"
        ? "#5f6ff7"
        : edge.kind === "injected"
          ? "#97a2f3"
          : "#7c88ff";
    const isDimmed =
      hasActiveMatches &&
      !matchIds.has(edge.from) &&
      !matchIds.has(edge.to);

    return {
      id: edge.id,
      source: edge.from,
      target: edge.to,
      label: edge.label,
      animated: edge.kind === "mixed",
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: stroke,
        width: 18,
        height: 18
      },
      style:
        edge.kind === "injected"
          ? {
              opacity: isDimmed ? 0.28 : 0.86,
              stroke,
              strokeDasharray: "8 6",
              strokeWidth: 1.85
            }
          : {
              opacity: isDimmed ? 0.28 : 0.96,
              stroke,
              strokeWidth: edge.kind === "mixed" ? 2.45 : 2.1
            },
      labelStyle: {
        fill: "#65718a",
        fontSize: 11,
        fontWeight: 600,
        fontFamily: "\"IBM Plex Mono\", monospace"
      },
      labelBgStyle: {
        fill: "rgba(252, 253, 255, 0.96)",
        stroke: "rgba(206, 214, 231, 0.9)"
      },
      labelBgPadding: [7, 4],
      labelBgBorderRadius: 999,
      type: "smoothstep"
    };
  });

  return { nodes, edges };
}

function buildRenderableNodes(
  graph: GraphIR,
  journey: GraphIRJourney
): RenderableNode[] {
  const entities = new Map(
    [...graph.entities.states, ...graph.entities.compositeStates].map((entity) => [entity.id, entity])
  );
  const memberStateIds = new Set(journey.memberStateIds);

  return journey.nodeIds
    .map((nodeId) => {
      const entity = entities.get(nodeId);

      if (!entity) {
        return null;
      }

      return {
        id: entity.id,
        type: entity.type,
        label: entity.label,
        tags: entity.tags,
        membership: memberStateIds.has(entity.id) ? "member" : "referenced",
        isStartState: entity.id === journey.startStateId,
        subjourneyId: entity.type === "CompositeState" ? entity.subjourneyId : undefined,
        source: entity.source
      } satisfies RenderableNode;
    })
    .filter((value) => value !== null);
}

function computeDepths(nodes: readonly RenderableNode[], journey: GraphIRJourney): Map<string, number> {
  const adjacency = new Map<string, string[]>();
  const depths = new Map<string, number>();
  const queue: string[] = [];
  const startNode = nodes.find((node) => node.isStartState) ?? nodes[0];

  if (startNode) {
    depths.set(startNode.id, 0);
    queue.push(startNode.id);
  }

  for (const edge of journey.edges) {
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

  for (const node of nodes) {
    if (depths.has(node.id)) {
      continue;
    }

    depths.set(node.id, fallbackDepth);
    fallbackDepth += 1;
  }

  return depths;
}

function getMatchState(
  nodeId: string,
  hasActiveMatches: boolean,
  matchIds: Set<string>
): NodeMatchState {
  if (!hasActiveMatches) {
    return "neutral";
  }

  return matchIds.has(nodeId) ? "matched" : "dimmed";
}

function matchesNode(node: RenderableNode, query: string): boolean {
  return [
    node.id,
    node.label,
    node.subjourneyId,
    node.source,
    ...node.tags
  ]
    .filter((value): value is string => typeof value === "string")
    .some((value) => value.toLowerCase().includes(query));
}

interface RenderableNode {
  id: string;
  type: StateEntity["type"] | CompositeStateEntity["type"];
  label: string;
  tags: string[];
  membership: "member" | "referenced";
  isStartState: boolean;
  subjourneyId?: string;
  source: string;
}
