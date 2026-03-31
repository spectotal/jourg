# @jourg/graph

`@jourg/graph` implements the current UJG Graph Editor's Draft from <https://ujg.specs.openuji.org/ed/graph>.

The package:

- indexes `Journey`, `State`, `CompositeState`, `Transition`, `OutgoingTransitionGroup`, and `OutgoingTransition` items from one or more `UJGDocument`s
- validates graph reference integrity across the provided document set
- materializes an effective journey graph, including outgoing-transition-group injection and deduplication
- supports both `type`/`id` and `@type`/`@id` item forms so it can consume Graph ED examples and compacted JSON-LD variants

## API

```ts
import {
  createGraphIndex,
  materializeJourney,
  validateGraph
} from "@jourg/graph";

const index = createGraphIndex([
  { source: "main.json", document: mainDocument },
  { source: "checkout.json", document: checkoutDocument }
]);

const validation = validateGraph(index);
const journey = materializeJourney(index, "urn:ujg:journey:main-site");
```

## Validation

The package enforces the Graph ED constraints that are currently explicit in the spec:

- `startState`, `stateRefs`, `transitionRefs`, `outgoingTransitionGroupRefs`, `outgoingTransitionRefs`, `from`, and `to` must resolve to valid nodes in scope
- `subjourneyId` must resolve to a valid `Journey`
- outgoing transition groups must resolve to `OutgoingTransitionGroup`
- outgoing transition references must resolve to `OutgoingTransition`

## Materialization

`materializeJourney()` returns:

- the selected journey entity
- member and referenced state nodes needed to render the journey
- effective edges where outgoing-transition-group injection has already been applied
- deduplicated explicit/injected edges with origin metadata
