import type {
  GraphDiagnostic,
  GraphNodeType
} from "../types.js";
import type { ExtractedGraph, GraphEntityIndex, StageResult } from "./state.js";

export function validateGraph(graph: ExtractedGraph): StageResult<ExtractedGraph> {
  const diagnostics: GraphDiagnostic[] = [];

  for (const journey of graph.entities.journeys) {
    const memberStateIds = new Set(journey.stateRefs);

    expectStateLike(graph.index, diagnostics, journey.source, journey.id, "$.startState", journey.startState);

    for (const [index, refId] of journey.stateRefs.entries()) {
      expectStateLike(graph.index, diagnostics, journey.source, journey.id, `$.stateRefs[${index}]`, refId);
    }

    for (const [index, refId] of journey.transitionRefs.entries()) {
      expectType(graph.index, diagnostics, journey.source, journey.id, `$.transitionRefs[${index}]`, refId, "Transition");
      expectTransitionStateMembership(
        graph.index,
        diagnostics,
        journey.source,
        journey.id,
        `$.transitionRefs[${index}]`,
        refId,
        memberStateIds
      );
    }

    for (const [index, refId] of journey.outgoingTransitionGroupRefs.entries()) {
      expectType(
        graph.index,
        diagnostics,
        journey.source,
        journey.id,
        `$.outgoingTransitionGroupRefs[${index}]`,
        refId,
        "OutgoingTransitionGroup"
      );
    }
  }

  for (const transition of graph.entities.transitions) {
    expectStateLike(graph.index, diagnostics, transition.source, transition.id, "$.from", transition.from);
    expectStateLike(graph.index, diagnostics, transition.source, transition.id, "$.to", transition.to);
  }

  for (const compositeState of graph.entities.compositeStates) {
    expectType(
      graph.index,
      diagnostics,
      compositeState.source,
      compositeState.id,
      "$.subjourneyId",
      compositeState.subjourneyId,
      "Journey"
    );
  }

  for (const group of graph.entities.outgoingTransitionGroups) {
    for (const [index, refId] of group.outgoingTransitionRefs.entries()) {
      expectType(
        graph.index,
        diagnostics,
        group.source,
        group.id,
        `$.outgoingTransitionRefs[${index}]`,
        refId,
        "OutgoingTransition"
      );
    }
  }

  for (const outgoingTransition of graph.entities.outgoingTransitions) {
    expectStateLike(
      graph.index,
      diagnostics,
      outgoingTransition.source,
      outgoingTransition.id,
      "$.to",
      outgoingTransition.to
    );
  }

  return {
    value: graph,
    diagnostics
  };
}

function expectTransitionStateMembership(
  index: GraphEntityIndex,
  diagnostics: GraphDiagnostic[],
  source: string,
  entityId: string,
  path: string,
  refId: string,
  memberStateIds: ReadonlySet<string>
) {
  const transition = index.transitionsById.get(refId);

  if (!transition) {
    return;
  }

  if (!memberStateIds.has(transition.from)) {
    diagnostics.push({
      severity: "error",
      code: "GRAPH_JOURNEY_TRANSITION_MEMBERSHIP",
      message: `Transition ${refId} has from state ${transition.from} that is not listed in stateRefs.`,
      source,
      entityId,
      path,
      refId
    });
  }

  if (!memberStateIds.has(transition.to)) {
    diagnostics.push({
      severity: "error",
      code: "GRAPH_JOURNEY_TRANSITION_MEMBERSHIP",
      message: `Transition ${refId} has to state ${transition.to} that is not listed in stateRefs.`,
      source,
      entityId,
      path,
      refId
    });
  }
}

function expectStateLike(
  index: GraphEntityIndex,
  diagnostics: GraphDiagnostic[],
  source: string,
  entityId: string,
  path: string,
  refId: string
) {
  const target = index.stateLikesById.get(refId);

  if (target) {
    return;
  }

  const wrongType = index.byId.get(refId);

  if (wrongType) {
    diagnostics.push({
      severity: "error",
      code: "GRAPH_REFERENCE_TYPE",
      message: `Reference ${refId} resolved to ${wrongType.type}, expected State or CompositeState.`,
      source,
      entityId,
      path,
      refId,
      expectedType: "StateLike",
      actualType: wrongType.type
    });
    return;
  }

  diagnostics.push({
    severity: "error",
    code: "GRAPH_REFERENCE_MISSING",
    message: `Reference ${refId} could not be resolved.`,
    source,
    entityId,
    path,
    refId,
    expectedType: "StateLike"
  });
}

function expectType(
  index: GraphEntityIndex,
  diagnostics: GraphDiagnostic[],
  source: string,
  entityId: string,
  path: string,
  refId: string,
  expectedType: GraphNodeType
) {
  const target = index.byId.get(refId);

  if (!target) {
    diagnostics.push({
      severity: "error",
      code: "GRAPH_REFERENCE_MISSING",
      message: `Reference ${refId} could not be resolved.`,
      source,
      entityId,
      path,
      refId,
      expectedType
    });
    return;
  }

  if (target.type === expectedType) {
    return;
  }

  diagnostics.push({
    severity: "error",
    code: "GRAPH_REFERENCE_TYPE",
    message: `Reference ${refId} resolved to ${target.type}, expected ${expectedType}.`,
    source,
    entityId,
    path,
    refId,
    expectedType,
    actualType: target.type
  });
}
