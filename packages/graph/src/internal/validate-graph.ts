import { uniqueDiagnostics } from "./common.js";
import type {
  GraphDiagnostic,
  GraphNodeType
} from "../types.js";
import type { ExtractedGraphBundle } from "./state.js";

export function validateGraphBundle(bundle: ExtractedGraphBundle): ExtractedGraphBundle {
  const diagnostics = [...bundle.diagnostics];

  for (const journey of bundle.entities.journeys) {
    expectStateLike(bundle, diagnostics, journey.source, journey.id, "$.startState", journey.startState);

    for (const [index, refId] of journey.stateRefs.entries()) {
      expectStateLike(bundle, diagnostics, journey.source, journey.id, `$.stateRefs[${index}]`, refId);
    }

    for (const [index, refId] of journey.transitionRefs.entries()) {
      expectType(bundle, diagnostics, journey.source, journey.id, `$.transitionRefs[${index}]`, refId, "Transition");
    }

    for (const [index, refId] of journey.outgoingTransitionGroupRefs.entries()) {
      expectType(
        bundle,
        diagnostics,
        journey.source,
        journey.id,
        `$.outgoingTransitionGroupRefs[${index}]`,
        refId,
        "OutgoingTransitionGroup"
      );
    }
  }

  for (const transition of bundle.entities.transitions) {
    expectStateLike(bundle, diagnostics, transition.source, transition.id, "$.from", transition.from);
    expectStateLike(bundle, diagnostics, transition.source, transition.id, "$.to", transition.to);
  }

  for (const compositeState of bundle.entities.compositeStates) {
    expectType(bundle, diagnostics, compositeState.source, compositeState.id, "$.subjourneyId", compositeState.subjourneyId, "Journey");
  }

  for (const group of bundle.entities.outgoingTransitionGroups) {
    for (const [index, refId] of group.outgoingTransitionRefs.entries()) {
      expectType(
        bundle,
        diagnostics,
        group.source,
        group.id,
        `$.outgoingTransitionRefs[${index}]`,
        refId,
        "OutgoingTransition"
      );
    }
  }

  for (const outgoingTransition of bundle.entities.outgoingTransitions) {
    expectStateLike(bundle, diagnostics, outgoingTransition.source, outgoingTransition.id, "$.to", outgoingTransition.to);
  }

  return {
    ...bundle,
    diagnostics: uniqueDiagnostics(diagnostics)
  };
}

function expectStateLike(
  bundle: ExtractedGraphBundle,
  diagnostics: GraphDiagnostic[],
  source: string,
  entityId: string,
  path: string,
  refId: string
) {
  const target = bundle.stateMap.get(refId) ?? bundle.compositeStateMap.get(refId);

  if (target) {
    return;
  }

  const wrongType = bundle.nodeMap.get(refId);

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
  bundle: ExtractedGraphBundle,
  diagnostics: GraphDiagnostic[],
  source: string,
  entityId: string,
  path: string,
  refId: string,
  expectedType: GraphNodeType
) {
  const target = bundle.nodeMap.get(refId);

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
