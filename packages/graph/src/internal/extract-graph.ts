import {
  getOptionalString,
  getOptionalStringArray,
  getRequiredString,
  getRequiredStringArray,
  GRAPH_NODE_TYPES,
  isJsonObject
} from "./common.js";
import type {
  CompositeStateEntity,
  GraphDiagnostic,
  GraphEntity,
  GraphIREntities,
  GraphNodeType,
  JourneyEntity,
  JsonObject,
  OutgoingTransitionEntity,
  OutgoingTransitionGroupEntity,
  StateEntity,
  TransitionEntity
} from "../types.js";
import type { CoreValidatedBundle, ExtractedGraphBundle } from "./state.js";

export function extractGraphBundle(bundle: CoreValidatedBundle): ExtractedGraphBundle {
  const diagnostics = [...bundle.diagnostics];
  const nodeMap = new Map<string, GraphEntity>();
  const journeyMap = new Map<string, JourneyEntity>();
  const stateMap = new Map<string, StateEntity>();
  const compositeStateMap = new Map<string, CompositeStateEntity>();
  const transitionMap = new Map<string, TransitionEntity>();
  const outgoingTransitionGroupMap = new Map<string, OutgoingTransitionGroupEntity>();
  const outgoingTransitionMap = new Map<string, OutgoingTransitionEntity>();

  for (const document of bundle.documents) {
    const nodes = Array.isArray(document.normalizedDocument.nodes)
      ? document.normalizedDocument.nodes
      : [];

    for (const [index, nodeValue] of nodes.entries()) {
      const path = `$.nodes[${index}]`;

      if (!isJsonObject(nodeValue)) {
        diagnostics.push({
          severity: "error",
          code: "INVALID_GRAPH_NODE",
          message: "Graph nodes must be JSON objects.",
          source: document.source,
          path
        });
        continue;
      }

      const type = getNodeType(nodeValue);

      if (!type) {
        continue;
      }

      const entity = normalizeGraphNode(type, nodeValue, document.source, path, diagnostics);

      if (!entity) {
        continue;
      }

      if (nodeMap.has(entity.id)) {
        diagnostics.push({
          severity: "error",
          code: "DUPLICATE_ID",
          message: `Duplicate graph node id ${entity.id} was found.`,
          source: document.source,
          entityId: entity.id,
          path
        });
        continue;
      }

      nodeMap.set(entity.id, entity);

      switch (entity.type) {
        case "Journey":
          journeyMap.set(entity.id, entity);
          break;
        case "State":
          stateMap.set(entity.id, entity);
          break;
        case "CompositeState":
          compositeStateMap.set(entity.id, entity);
          break;
        case "Transition":
          transitionMap.set(entity.id, entity);
          break;
        case "OutgoingTransitionGroup":
          outgoingTransitionGroupMap.set(entity.id, entity);
          break;
        case "OutgoingTransition":
          outgoingTransitionMap.set(entity.id, entity);
          break;
      }
    }
  }

  const entities: GraphIREntities = {
    journeys: sortEntities(journeyMap),
    states: sortEntities(stateMap),
    compositeStates: sortEntities(compositeStateMap),
    transitions: sortEntities(transitionMap),
    outgoingTransitionGroups: sortEntities(outgoingTransitionGroupMap),
    outgoingTransitions: sortEntities(outgoingTransitionMap)
  };

  return {
    ...bundle,
    diagnostics,
    entities,
    nodeMap,
    journeyMap,
    stateMap,
    compositeStateMap,
    transitionMap,
    outgoingTransitionGroupMap,
    outgoingTransitionMap
  };
}

function sortEntities<T extends GraphEntity>(map: ReadonlyMap<string, T>): T[] {
  return Array.from(map.values()).sort((left, right) => left.id.localeCompare(right.id));
}

function getNodeType(value: JsonObject): GraphNodeType | undefined {
  const type = getOptionalString(value["@type"]);
  return type && GRAPH_NODE_TYPES.has(type as GraphNodeType)
    ? (type as GraphNodeType)
    : undefined;
}

function normalizeGraphNode(
  type: GraphNodeType,
  node: JsonObject,
  source: string,
  path: string,
  diagnostics: GraphDiagnostic[]
): GraphEntity | undefined {
  const id = getRequiredString(node["@id"]);

  if (!id) {
    diagnostics.push({
      severity: "error",
      code: "INVALID_GRAPH_NODE",
      message: `${type} nodes must include "@id".`,
      source,
      path
    });
    return undefined;
  }

  switch (type) {
    case "Journey": {
      const startState = getRequiredString(node.startState);
      const stateRefs = getRequiredStringArray(node.stateRefs, 1);
      const transitionRefs = getRequiredStringArray(node.transitionRefs, 1);
      const outgoingTransitionGroupRefs = getOptionalStringArray(node.outgoingTransitionGroupRefs);

      if (!startState || !stateRefs || !transitionRefs || !outgoingTransitionGroupRefs) {
        diagnostics.push({
          severity: "error",
          code: "INVALID_GRAPH_NODE",
          message:
            'Journey nodes must include string "startState", "stateRefs", and "transitionRefs".',
          source,
          entityId: id,
          path
        });
        return undefined;
      }

      return {
        id,
        type,
        source,
        path,
        startState,
        stateRefs,
        transitionRefs,
        outgoingTransitionGroupRefs
      };
    }
    case "State": {
      const label = getRequiredString(node.label);
      const tags = getOptionalStringArray(node.tags);

      if (!label || !tags) {
        diagnostics.push({
          severity: "error",
          code: "INVALID_GRAPH_NODE",
          message:
            'State nodes must include string "label", and "tags" must be string arrays when present.',
          source,
          entityId: id,
          path
        });
        return undefined;
      }

      return {
        id,
        type,
        source,
        path,
        label,
        tags
      };
    }
    case "CompositeState": {
      const label = getRequiredString(node.label);
      const subjourneyId = getRequiredString(node.subjourneyId);
      const tags = getOptionalStringArray(node.tags);

      if (!label || !subjourneyId || !tags) {
        diagnostics.push({
          severity: "error",
          code: "INVALID_GRAPH_NODE",
          message:
            'CompositeState nodes must include string "label", string "subjourneyId", and string-array "tags" when present.',
          source,
          entityId: id,
          path
        });
        return undefined;
      }

      return {
        id,
        type,
        source,
        path,
        label,
        tags,
        subjourneyId
      };
    }
    case "Transition": {
      const from = getRequiredString(node.from);
      const to = getRequiredString(node.to);
      const label = getOptionalString(node.label);

      if (!from || !to) {
        diagnostics.push({
          severity: "error",
          code: "INVALID_GRAPH_NODE",
          message: 'Transition nodes must include string "from" and string "to".',
          source,
          entityId: id,
          path
        });
        return undefined;
      }

      return {
        id,
        type,
        source,
        path,
        from,
        to,
        label
      };
    }
    case "OutgoingTransitionGroup": {
      const outgoingTransitionRefs = getRequiredStringArray(node.outgoingTransitionRefs, 1);

      if (!outgoingTransitionRefs) {
        diagnostics.push({
          severity: "error",
          code: "INVALID_GRAPH_NODE",
          message:
            'OutgoingTransitionGroup nodes must include "outgoingTransitionRefs" as a non-empty string array.',
          source,
          entityId: id,
          path
        });
        return undefined;
      }

      return {
        id,
        type,
        source,
        path,
        outgoingTransitionRefs
      };
    }
    case "OutgoingTransition": {
      const to = getRequiredString(node.to);
      const label = getOptionalString(node.label);

      if (!to) {
        diagnostics.push({
          severity: "error",
          code: "INVALID_GRAPH_NODE",
          message: 'OutgoingTransition nodes must include string "to".',
          source,
          entityId: id,
          path
        });
        return undefined;
      }

      return {
        id,
        type,
        source,
        path,
        to,
        label
      };
    }
  }
}
