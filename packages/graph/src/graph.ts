import type {
  CompositeStateEntity,
  EffectiveEdgeOrigin,
  GraphDiagnostic,
  GraphDocument,
  GraphDocumentInput,
  GraphEntity,
  GraphIndex,
  GraphNodeType,
  GraphValidationResult,
  IndexedGraphDocument,
  JourneyEntity,
  JsonObject,
  JsonValue,
  MaterializedJourneyEdge,
  MaterializedJourneyGraph,
  OutgoingTransitionEntity,
  OutgoingTransitionGroupEntity,
  StateEntity,
  StateLikeEntity,
  TransitionEntity
} from "./types.js";

const GRAPH_NODE_TYPES = new Set<GraphNodeType>([
  "Journey",
  "State",
  "CompositeState",
  "Transition",
  "OutgoingTransitionGroup",
  "OutgoingTransition"
]);

export function createGraphIndex(inputs: readonly GraphDocumentInput[]): GraphIndex {
  const diagnostics: GraphDiagnostic[] = [];
  const documents: IndexedGraphDocument[] = [];
  const nodes = new Map<string, GraphEntity>();
  const journeys = new Map<string, JourneyEntity>();
  const states = new Map<string, StateEntity>();
  const compositeStates = new Map<string, CompositeStateEntity>();
  const transitions = new Map<string, TransitionEntity>();
  const outgoingTransitionGroups = new Map<string, OutgoingTransitionGroupEntity>();
  const outgoingTransitions = new Map<string, OutgoingTransitionEntity>();

  for (const [documentIndex, input] of inputs.entries()) {
    const document = input.document as GraphDocument;
    const source =
      input.source ??
      (typeof document["@id"] === "string" ? document["@id"] : `document-${documentIndex + 1}`);
    const indexedDocument: IndexedGraphDocument = {
      source,
      document,
      nodeIds: []
    };

    documents.push(indexedDocument);

    if ("@type" in document && document["@type"] !== "UJGDocument") {
      diagnostics.push({
        severity: "error",
        code: "INVALID_GRAPH_DOCUMENT",
        message: 'Graph documents must use "@type": "UJGDocument".',
        source,
        path: "$.@type"
      });
    }

    if ("nodes" in document && !Array.isArray(document.nodes)) {
      diagnostics.push({
        severity: "error",
        code: "INVALID_GRAPH_DOCUMENT",
        message: "Graph documents must expose nodes as an array when present.",
        source,
        path: "$.nodes"
      });
      continue;
    }

    const nodeValues = Array.isArray(document.nodes) ? document.nodes : [];

    for (const [nodeIndex, nodeValue] of nodeValues.entries()) {
      const path = `$.nodes[${nodeIndex}]`;

      if (!isJsonObject(nodeValue)) {
        diagnostics.push({
          severity: "error",
          code: "INVALID_GRAPH_NODE",
          message: "Graph nodes must be JSON objects.",
          source,
          path
        });
        continue;
      }

      const type = getNodeType(nodeValue);

      if (!type || !GRAPH_NODE_TYPES.has(type)) {
        continue;
      }

      const entity = normalizeGraphNode(type, nodeValue, source, path, diagnostics);

      if (!entity) {
        continue;
      }

      if (nodes.has(entity.id)) {
        diagnostics.push({
          severity: "error",
          code: "DUPLICATE_NODE_ID",
          message: `Duplicate graph node id ${entity.id} was found.`,
          source,
          nodeId: entity.id,
          path
        });
        continue;
      }

      nodes.set(entity.id, entity);
      indexedDocument.nodeIds.push(entity.id);

      switch (entity.type) {
        case "Journey":
          journeys.set(entity.id, entity);
          break;
        case "State":
          states.set(entity.id, entity);
          break;
        case "CompositeState":
          compositeStates.set(entity.id, entity);
          break;
        case "Transition":
          transitions.set(entity.id, entity);
          break;
        case "OutgoingTransitionGroup":
          outgoingTransitionGroups.set(entity.id, entity);
          break;
        case "OutgoingTransition":
          outgoingTransitions.set(entity.id, entity);
          break;
      }
    }
  }

  return {
    documents,
    nodes,
    journeys,
    states,
    compositeStates,
    transitions,
    outgoingTransitionGroups,
    outgoingTransitions,
    diagnostics: uniqueDiagnostics(diagnostics)
  };
}

export function validateGraph(input: GraphIndex | readonly GraphDocumentInput[]): GraphValidationResult {
  const index = isGraphIndex(input) ? input : createGraphIndex(input);
  const diagnostics = [...index.diagnostics];

  for (const journey of index.journeys.values()) {
    expectStateLike(index, diagnostics, journey.source, journey.id, "$.startState", journey.startState);

    for (const [refIndex, refId] of journey.stateRefs.entries()) {
      expectStateLike(index, diagnostics, journey.source, journey.id, `$.stateRefs[${refIndex}]`, refId);
    }

    for (const [refIndex, refId] of journey.transitionRefs.entries()) {
      expectType(
        index,
        diagnostics,
        journey.source,
        journey.id,
        `$.transitionRefs[${refIndex}]`,
        refId,
        "Transition"
      );
    }

    for (const [refIndex, refId] of journey.outgoingTransitionGroupRefs.entries()) {
      expectType(
        index,
        diagnostics,
        journey.source,
        journey.id,
        `$.outgoingTransitionGroupRefs[${refIndex}]`,
        refId,
        "OutgoingTransitionGroup"
      );
    }
  }

  for (const transition of index.transitions.values()) {
    expectStateLike(index, diagnostics, transition.source, transition.id, "$.from", transition.from);
    expectStateLike(index, diagnostics, transition.source, transition.id, "$.to", transition.to);
  }

  for (const compositeState of index.compositeStates.values()) {
    expectType(
      index,
      diagnostics,
      compositeState.source,
      compositeState.id,
      "$.subjourneyId",
      compositeState.subjourneyId,
      "Journey"
    );
  }

  for (const group of index.outgoingTransitionGroups.values()) {
    for (const [refIndex, refId] of group.outgoingTransitionRefs.entries()) {
      expectType(
        index,
        diagnostics,
        group.source,
        group.id,
        `$.outgoingTransitionRefs[${refIndex}]`,
        refId,
        "OutgoingTransition"
      );
    }
  }

  for (const outgoingTransition of index.outgoingTransitions.values()) {
    expectStateLike(index, diagnostics, outgoingTransition.source, outgoingTransition.id, "$.to", outgoingTransition.to);
  }

  const unique = uniqueDiagnostics(diagnostics);

  return {
    ok: unique.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics: unique
  };
}

export function materializeJourney(
  input: GraphIndex | readonly GraphDocumentInput[],
  journeyId: string
): MaterializedJourneyGraph {
  const index = isGraphIndex(input) ? input : createGraphIndex(input);
  const validation = validateGraph(index);
  const journey = index.journeys.get(journeyId) ?? null;

  if (!journey) {
    return {
      journey: null,
      nodes: [],
      edges: [],
      diagnostics: [
        ...validation.diagnostics,
        {
          severity: "error",
          code: "JOURNEY_NOT_FOUND",
          message: `Journey ${journeyId} was not found in the provided documents.`,
          nodeId: journeyId
        }
      ]
    };
  }

  const memberStateIds = new Set<string>();
  const includedStateIds = new Set<string>();
  const edgeMap = new Map<string, MaterializedJourneyEdge>();

  for (const refId of journey.stateRefs) {
    const stateLike = getStateLike(index, refId);

    if (!stateLike) {
      continue;
    }

    memberStateIds.add(refId);
    includedStateIds.add(refId);
  }

  const startState = getStateLike(index, journey.startState);

  if (startState) {
    includedStateIds.add(startState.id);
  }

  for (const transitionId of journey.transitionRefs) {
    const transition = index.transitions.get(transitionId);

    if (!transition) {
      continue;
    }

    const from = getStateLike(index, transition.from);
    const to = getStateLike(index, transition.to);

    if (!from || !to) {
      continue;
    }

    includedStateIds.add(from.id);
    includedStateIds.add(to.id);
    mergeEdge(edgeMap, from.id, to.id, transition.label, {
      kind: "explicit",
      transitionId: transition.id,
      label: transition.label
    });
  }

  for (const groupId of journey.outgoingTransitionGroupRefs) {
    const group = index.outgoingTransitionGroups.get(groupId);

    if (!group) {
      continue;
    }

    const groupTransitions = group.outgoingTransitionRefs
      .map((refId) => index.outgoingTransitions.get(refId))
      .filter((value): value is OutgoingTransitionEntity => Boolean(value));

    for (const stateId of memberStateIds) {
      for (const outgoingTransition of groupTransitions) {
        const target = getStateLike(index, outgoingTransition.to);

        if (!target) {
          continue;
        }

        includedStateIds.add(target.id);
        mergeEdge(edgeMap, stateId, target.id, outgoingTransition.label, {
          kind: "injected",
          groupId: group.id,
          outgoingTransitionId: outgoingTransition.id,
          label: outgoingTransition.label
        });
      }
    }
  }

  const nodes = Array.from(includedStateIds)
    .map((id) => getStateLike(index, id))
    .filter((value): value is StateLikeEntity => Boolean(value))
    .sort((left, right) => left.label.localeCompare(right.label))
    .map((stateLike) => ({
      id: stateLike.id,
      type: stateLike.type,
      label: stateLike.label,
      tags: stateLike.tags,
      membership: memberStateIds.has(stateLike.id)
        ? ("member" as const)
        : ("referenced" as const),
      isStartState: journey.startState === stateLike.id,
      subjourneyId:
        stateLike.type === "CompositeState" ? stateLike.subjourneyId : undefined,
      source: stateLike.source
    }));

  const edges = Array.from(edgeMap.values()).sort((left, right) =>
    `${left.from}-${left.to}`.localeCompare(`${right.from}-${right.to}`)
  );

  return {
    journey,
    nodes,
    edges,
    diagnostics: validation.diagnostics
  };
}

function normalizeGraphNode(
  type: GraphNodeType,
  node: JsonObject,
  source: string,
  path: string,
  diagnostics: GraphDiagnostic[]
): GraphEntity | undefined {
  const id = getNodeId(node);

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
          nodeId: id,
          path
        });
        return undefined;
      }

      return {
        id,
        type,
        source,
        raw: node,
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
          message: 'State nodes must include string "label", and "tags" must be string arrays when present.',
          source,
          nodeId: id,
          path
        });
        return undefined;
      }

      return {
        id,
        type,
        source,
        raw: node,
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
          nodeId: id,
          path
        });
        return undefined;
      }

      return {
        id,
        type,
        source,
        raw: node,
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
          nodeId: id,
          path
        });
        return undefined;
      }

      return {
        id,
        type,
        source,
        raw: node,
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
          nodeId: id,
          path
        });
        return undefined;
      }

      return {
        id,
        type,
        source,
        raw: node,
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
          nodeId: id,
          path
        });
        return undefined;
      }

      return {
        id,
        type,
        source,
        raw: node,
        to,
        label
      };
    }
  }
}

function expectStateLike(
  index: GraphIndex,
  diagnostics: GraphDiagnostic[],
  source: string,
  nodeId: string,
  path: string,
  refId: string
) {
  const stateLike = getStateLike(index, refId);

  if (stateLike) {
    return;
  }

  const target = index.nodes.get(refId);

  if (!target) {
    diagnostics.push({
      severity: "error",
      code: "GRAPH_REFERENCE_MISSING",
      message: `Reference ${refId} could not be resolved.`,
      source,
      nodeId,
      path,
      refId,
      expectedType: "StateLike"
    });
    return;
  }

  diagnostics.push({
    severity: "error",
    code: "GRAPH_REFERENCE_TYPE",
    message: `Reference ${refId} resolved to ${target.type}, expected State or CompositeState.`,
    source,
    nodeId,
    path,
    refId,
    expectedType: "StateLike"
  });
}

function expectType(
  index: GraphIndex,
  diagnostics: GraphDiagnostic[],
  source: string,
  nodeId: string,
  path: string,
  refId: string,
  expectedType: GraphNodeType
) {
  const target = index.nodes.get(refId);

  if (!target) {
    diagnostics.push({
      severity: "error",
      code: "GRAPH_REFERENCE_MISSING",
      message: `Reference ${refId} could not be resolved.`,
      source,
      nodeId,
      path,
      refId,
      expectedType
    });
    return;
  }

  if (target.type !== expectedType) {
    diagnostics.push({
      severity: "error",
      code: "GRAPH_REFERENCE_TYPE",
      message: `Reference ${refId} resolved to ${target.type}, expected ${expectedType}.`,
      source,
      nodeId,
      path,
      refId,
      expectedType
    });
  }
}

function getStateLike(index: GraphIndex, id: string): StateLikeEntity | undefined {
  return index.states.get(id) ?? index.compositeStates.get(id);
}

function mergeEdge(
  edgeMap: Map<string, MaterializedJourneyEdge>,
  from: string,
  to: string,
  label: string | undefined,
  origin: EffectiveEdgeOrigin
) {
  const key = `${from}::${to}`;
  const existing = edgeMap.get(key);

  if (!existing) {
    edgeMap.set(key, {
      id: key,
      from,
      to,
      label,
      kind: origin.kind,
      origins: [origin]
    });
    return;
  }

  existing.origins.push(origin);
  existing.kind = existing.kind === origin.kind ? existing.kind : "mixed";
  existing.label ??= label;
}

function getNodeType(value: JsonObject): GraphNodeType | undefined {
  const type = getOptionalString(value["@type"]);
  return type && GRAPH_NODE_TYPES.has(type as GraphNodeType)
    ? (type as GraphNodeType)
    : undefined;
}

function getNodeId(value: JsonObject): string | undefined {
  return getRequiredString(value["@id"]);
}

function getRequiredString(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getOptionalString(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getRequiredStringArray(
  value: JsonValue | undefined,
  minimumLength: number
): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  if (value.length < minimumLength || value.some((item) => typeof item !== "string")) {
    return undefined;
  }

  return value as string[];
}

function getOptionalStringArray(value: JsonValue | undefined): string[] | undefined {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return undefined;
  }

  return value as string[];
}

function isGraphIndex(value: GraphIndex | readonly GraphDocumentInput[]): value is GraphIndex {
  return typeof value === "object" && value !== null && "nodes" in value;
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uniqueDiagnostics(diagnostics: GraphDiagnostic[]): GraphDiagnostic[] {
  const seen = new Set<string>();

  return diagnostics.filter((diagnostic) => {
    const key = JSON.stringify(diagnostic);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
