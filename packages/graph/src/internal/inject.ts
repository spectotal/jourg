import type {
  CompositeStateEntity,
  GraphEntity,
  GraphIRJourney,
  GraphIRJourneyEdge,
  GraphIRJourneyEdgeOrigin,
  StateEntity
} from "../types.js";
import type { ExtractedGraphBundle, InjectedGraphBundle } from "./state.js";

type StateLikeEntity = StateEntity | CompositeStateEntity;

export function injectJourneys(bundle: ExtractedGraphBundle): InjectedGraphBundle {
  const journeys = bundle.entities.journeys
    .map((journey) => {
      const memberStateIds: string[] = [];
      const memberStateSet = new Set<string>();
      const includedStateIds = new Set<string>();
      const edgeMap = new Map<string, GraphIRJourneyEdge>();

      for (const refId of journey.stateRefs) {
        const stateLike = getStateLike(bundle, refId);

        if (!stateLike || memberStateSet.has(refId)) {
          continue;
        }

        memberStateSet.add(refId);
        memberStateIds.push(refId);
        includedStateIds.add(refId);
      }

      includedStateIds.add(journey.startState);

      for (const transitionId of journey.transitionRefs) {
        const transition = bundle.transitionMap.get(transitionId);

        if (!transition) {
          continue;
        }

        includedStateIds.add(transition.from);
        includedStateIds.add(transition.to);
        mergeEdge(edgeMap, transition.from, transition.to, transition.label, {
          kind: "explicit",
          source: transition.source,
          transitionId: transition.id,
          label: transition.label
        });
      }

      for (const groupId of journey.outgoingTransitionGroupRefs) {
        const group = bundle.outgoingTransitionGroupMap.get(groupId);

        if (!group) {
          continue;
        }

        for (const stateId of memberStateIds) {
          for (const outgoingTransitionId of group.outgoingTransitionRefs) {
            const outgoingTransition = bundle.outgoingTransitionMap.get(outgoingTransitionId);

            if (!outgoingTransition) {
              continue;
            }

            if(stateId == outgoingTransition.to) {
              continue;
            }

            includedStateIds.add(outgoingTransition.to);
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

      return {
        id: journey.id,
        source: journey.source,
        startStateId: journey.startState,
        memberStateIds,
        includedStateIds: Array.from(includedStateIds).sort(),
        nodeIds: Array.from(includedStateIds).sort(),
        edges: Array.from(edgeMap.values()).sort((left, right) => left.id.localeCompare(right.id))
      } satisfies GraphIRJourney;
    })
    .sort((left, right) => left.id.localeCompare(right.id));

  return {
    ...bundle,
    journeys
  };
}

function getStateLike(bundle: ExtractedGraphBundle, id: string): StateLikeEntity | undefined {
  return bundle.stateMap.get(id) ?? bundle.compositeStateMap.get(id);
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
