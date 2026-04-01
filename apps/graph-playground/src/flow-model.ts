import type {
  CompositeStateEntity,
  GraphIR,
  GraphIRJourney,
  StateEntity
} from "@jourg/graph";

type RenderableEntity = StateEntity | CompositeStateEntity;

export interface RenderableNode {
  id: string;
  type: StateEntity["type"] | CompositeStateEntity["type"];
  label: string;
  tags: string[];
  membership: "member" | "referenced";
  isStartState: boolean;
  subjourneyId?: string;
  source: string;
}

const renderableEntityIndexCache = new WeakMap<GraphIR, Map<string, RenderableEntity>>();

export function getRenderableEntityIndex(graph: GraphIR): Map<string, RenderableEntity> {
  const cached = renderableEntityIndexCache.get(graph);

  if (cached) {
    return cached;
  }

  const next = new Map<string, RenderableEntity>();

  for (const entity of graph.entities.states) {
    next.set(entity.id, entity);
  }

  for (const entity of graph.entities.compositeStates) {
    next.set(entity.id, entity);
  }

  renderableEntityIndexCache.set(graph, next);
  return next;
}

export function buildRenderableNodes(graph: GraphIR, journey: GraphIRJourney): RenderableNode[] {
  const entities = getRenderableEntityIndex(graph);
  const memberStateIds = new Set(journey.memberStateIds);
  const nodes: RenderableNode[] = [];

  for (const nodeId of journey.nodeIds) {
    const entity = entities.get(nodeId);

    if (!entity) {
      continue;
    }

    nodes.push({
      id: entity.id,
      type: entity.type,
      label: entity.label,
      tags: entity.tags,
      membership: memberStateIds.has(entity.id) ? "member" : "referenced",
      isStartState: entity.id === journey.startStateId,
      subjourneyId: entity.type === "CompositeState" ? entity.subjourneyId : undefined,
      source: entity.source
    });
  }

  return nodes;
}

export function computeDepths(nodes: readonly RenderableNode[], journey: GraphIRJourney): Map<string, number> {
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

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];

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
