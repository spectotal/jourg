import type {
  CompositeStateEntity,
  EffectiveEdgeOrigin,
  GraphDiagnostic,
  GraphDocument,
  GraphDocumentInput,
  GraphEntity,
  GraphIndex,
  GraphItemType,
  GraphValidationResult,
  IndexedGraphDocument,
  JourneyEntity,
  JsonObject,
  JsonValue,
  MaterializedJourneyEdge,
  MaterializedJourneyGraph,
  MaterializedJourneyNode,
  OutgoingTransitionEntity,
  OutgoingTransitionGroupEntity,
  StateEntity,
  StateLikeEntity,
  TransitionEntity
} from "./types.js";

const GRAPH_ITEM_TYPES = new Set<GraphItemType>([
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
  const items = new Map<string, GraphEntity>();
  const journeys = new Map<string, JourneyEntity>();
  const states = new Map<string, StateEntity>();
  const compositeStates = new Map<string, CompositeStateEntity>();
  const transitions = new Map<string, TransitionEntity>();
  const outgoingTransitionGroups = new Map<string, OutgoingTransitionGroupEntity>();
  const outgoingTransitions = new Map<string, OutgoingTransitionEntity>();

  for (const [documentIndex, input] of inputs.entries()) {
    const source = input.source ?? `document-${documentIndex + 1}`;
    const document = input.document as GraphDocument;
    const indexedDocument: IndexedGraphDocument = {
      source,
      document,
      itemIds: []
    };

    documents.push(indexedDocument);

    if ("items" in document && !Array.isArray(document.items)) {
      diagnostics.push({
        severity: "error",
        code: "INVALID_GRAPH_DOCUMENT",
        message: "Graph documents must expose items as an array when present.",
        source,
        path: "$.items"
      });
      continue;
    }

    const itemValues = Array.isArray(document.items) ? document.items : [];

    for (const [itemIndex, itemValue] of itemValues.entries()) {
      const path = `$.items[${itemIndex}]`;

      if (!isJsonObject(itemValue)) {
        diagnostics.push({
          severity: "error",
          code: "INVALID_GRAPH_ITEM",
          message: "Graph items must be JSON objects.",
          source,
          path
        });
        continue;
      }

      const type = getEntityType(itemValue);

      if (!type || !GRAPH_ITEM_TYPES.has(type)) {
        continue;
      }

      const entity = normalizeGraphEntity(type, itemValue, source, path, diagnostics);

      if (!entity) {
        continue;
      }

      if (items.has(entity.id)) {
        diagnostics.push({
          severity: "error",
          code: "DUPLICATE_ITEM_ID",
          message: `Duplicate graph item id ${entity.id} was found.`,
          source,
          itemId: entity.id,
          path
        });
        continue;
      }

      items.set(entity.id, entity);
      indexedDocument.itemIds.push(entity.id);

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
    items,
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
          itemId: journeyId
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

    const outgoingTransitions = group.outgoingTransitionRefs
      .map((refId) => index.outgoingTransitions.get(refId))
      .filter((value): value is OutgoingTransitionEntity => Boolean(value));

    for (const stateId of memberStateIds) {
      for (const outgoingTransition of outgoingTransitions) {
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

function normalizeGraphEntity(
  type: GraphItemType,
  item: JsonObject,
  source: string,
  path: string,
  diagnostics: GraphDiagnostic[]
): GraphEntity | undefined {
  const id = getEntityId(item);

  if (!id) {
    diagnostics.push({
      severity: "error",
      code: "INVALID_GRAPH_ITEM",
      message: `${type} items must include an id.`,
      source,
      path
    });
    return undefined;
  }

  switch (type) {
    case "Journey": {
      const startState = getRefId(item.startState);
      const stateRefs = getRefList(item.stateRefs);
      const transitionRefs = getRefList(item.transitionRefs);
      const outgoingTransitionGroupRefs = getRefList(item.outgoingTransitionGroupRefs);

      if (!startState || !Array.isArray(item.stateRefs) || !Array.isArray(item.transitionRefs)) {
        diagnostics.push({
          severity: "error",
          code: "INVALID_GRAPH_ITEM",
          message:
            "Journey items must include startState, stateRefs, and transitionRefs with valid reference values.",
          source,
          itemId: id,
          path
        });
        return undefined;
      }

      return {
        id,
        type,
        source,
        raw: item,
        startState,
        stateRefs,
        transitionRefs,
        outgoingTransitionGroupRefs
      };
    }
    case "State": {
      const label = getString(item.label);

      if (!label) {
        diagnostics.push({
          severity: "error",
          code: "INVALID_GRAPH_ITEM",
          message: "State items must include a label.",
          source,
          itemId: id,
          path
        });
        return undefined;
      }

      return {
        id,
        type,
        source,
        raw: item,
        label,
        tags: getStringList(item.tags)
      };
    }
    case "CompositeState": {
      const label = getString(item.label);
      const subjourneyId = getRefId(item.subjourneyId);

      if (!label || !subjourneyId) {
        diagnostics.push({
          severity: "error",
          code: "INVALID_GRAPH_ITEM",
          message: "CompositeState items must include label and subjourneyId.",
          source,
          itemId: id,
          path
        });
        return undefined;
      }

      return {
        id,
        type,
        source,
        raw: item,
        label,
        tags: getStringList(item.tags),
        subjourneyId
      };
    }
    case "Transition": {
      const from = getRefId(item.from);
      const to = getRefId(item.to);

      if (!from || !to) {
        diagnostics.push({
          severity: "error",
          code: "INVALID_GRAPH_ITEM",
          message: "Transition items must include valid from and to references.",
          source,
          itemId: id,
          path
        });
        return undefined;
      }

      return {
        id,
        type,
        source,
        raw: item,
        from,
        to,
        label: getString(item.label)
      };
    }
    case "OutgoingTransitionGroup": {
      if (!Array.isArray(item.outgoingTransitionRefs)) {
        diagnostics.push({
          severity: "error",
          code: "INVALID_GRAPH_ITEM",
          message: "OutgoingTransitionGroup items must include outgoingTransitionRefs.",
          source,
          itemId: id,
          path
        });
        return undefined;
      }

      return {
        id,
        type,
        source,
        raw: item,
        outgoingTransitionRefs: getRefList(item.outgoingTransitionRefs)
      };
    }
    case "OutgoingTransition": {
      const to = getRefId(item.to);

      if (!to) {
        diagnostics.push({
          severity: "error",
          code: "INVALID_GRAPH_ITEM",
          message: "OutgoingTransition items must include a valid to reference.",
          source,
          itemId: id,
          path
        });
        return undefined;
      }

      return {
        id,
        type,
        source,
        raw: item,
        to,
        label: getString(item.label)
      };
    }
  }
}

function expectStateLike(
  index: GraphIndex,
  diagnostics: GraphDiagnostic[],
  source: string,
  itemId: string,
  path: string,
  refId: string
) {
  const stateLike = getStateLike(index, refId);

  if (stateLike) {
    return;
  }

  const target = index.items.get(refId);

  if (!target) {
    diagnostics.push({
      severity: "error",
      code: "GRAPH_REFERENCE_MISSING",
      message: `Reference ${refId} could not be resolved.`,
      source,
      itemId,
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
    itemId,
    path,
    refId,
    expectedType: "StateLike"
  });
}

function expectType(
  index: GraphIndex,
  diagnostics: GraphDiagnostic[],
  source: string,
  itemId: string,
  path: string,
  refId: string,
  expectedType: GraphItemType
) {
  const target = index.items.get(refId);

  if (!target) {
    diagnostics.push({
      severity: "error",
      code: "GRAPH_REFERENCE_MISSING",
      message: `Reference ${refId} could not be resolved.`,
      source,
      itemId,
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
      itemId,
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

function getEntityType(value: JsonObject): GraphItemType | undefined {
  const type = getString(value.type) ?? getString(value["@type"]);
  return type && GRAPH_ITEM_TYPES.has(type as GraphItemType)
    ? (type as GraphItemType)
    : undefined;
}

function getEntityId(value: JsonObject): string | undefined {
  return getString(value.id) ?? getString(value["@id"]);
}

function getRefId(value: JsonValue | undefined): string | undefined {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (isJsonObject(value)) {
    return getEntityId(value);
  }

  return undefined;
}

function getRefList(value: JsonValue | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => getRefId(item))
    .filter((item): item is string => Boolean(item));
}

function getString(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getStringList(value: JsonValue | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function isGraphIndex(value: GraphIndex | readonly GraphDocumentInput[]): value is GraphIndex {
  return typeof value === "object" && value !== null && "items" in value;
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
