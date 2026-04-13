import type {
  CompositeStateEntity,
  GraphIRJourney,
  GraphIRJourneyEdge,
  GraphIRJourneyEdgeOrigin,
  StateEntity
} from "../types.js";
import type { ExtractedGraph, GraphEntityIndex, InjectedJourneys } from "./state.js";

type StateLikeEntity = StateEntity | CompositeStateEntity;

export function injectJourneys(graph: ExtractedGraph): InjectedJourneys {
  const journeys = graph.entities.journeys
    .map((journey) => {
      const memberStateIds: string[] = [];
      const memberStateSet = new Set<string>();
      const includedStateSet = new Set<string>();
      const edgeMap = new Map<string, GraphIRJourneyEdge>();

      for (const refId of journey.stateRefs) {
        const stateLike = getStateLike(graph.index, refId);

        if (!stateLike || memberStateSet.has(refId)) {
          continue;
        }

        memberStateSet.add(refId);
        memberStateIds.push(refId);
        includedStateSet.add(refId);
      }

      includedStateSet.add(journey.startState);

      for (const transitionId of journey.transitionRefs) {
        const transition = graph.index.transitionsById.get(transitionId);

        if (!transition) {
          continue;
        }

        includedStateSet.add(transition.from);
        includedStateSet.add(transition.to);
        mergeEdge(edgeMap, transition.from, transition.to, transition.label, {
          kind: "explicit",
          source: transition.source,
          transitionId: transition.id,
          label: transition.label
        });
      }

      for (const groupId of journey.outgoingTransitionGroupRefs) {
        const group = graph.index.outgoingGroupsById.get(groupId);

        if (!group) {
          continue;
        }

        for (const stateId of memberStateIds) {
          for (const outgoingTransitionId of group.outgoingTransitionRefs) {
            const outgoingTransition = graph.index.outgoingTransitionsById.get(outgoingTransitionId);

            if (!outgoingTransition) {
              continue;
            }

            if (stateId === outgoingTransition.to) {
              continue;
            }

            includedStateSet.add(outgoingTransition.to);
            mergeEdge(edgeMap, stateId, outgoingTransition.to, outgoingTransition.label, {
              kind: "injected",
              source: outgoingTransition.source,
              groupId: group.id,
              outgoingTransitionId: outgoingTransition.id,
              label: outgoingTransition.label
            });
          }
        }
      }

      const includedStateIds = Array.from(includedStateSet).sort();

      return {
        id: journey.id,
        source: journey.source,
        startStateId: journey.startState,
        memberStateIds,
        includedStateIds,
        edges: Array.from(edgeMap.values()).sort((left, right) => left.id.localeCompare(right.id))
      } satisfies GraphIRJourney;
    })
    .sort((left, right) => left.id.localeCompare(right.id));

  return { journeys };
}

function getStateLike(index: GraphEntityIndex, id: string): StateLikeEntity | undefined {
  return index.stateLikesById.get(id);
}

function mergeEdge(
  edgeMap: Map<string, GraphIRJourneyEdge>,
  from: string,
  to: string,
  label: string | undefined,
  origin: GraphIRJourneyEdgeOrigin
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
