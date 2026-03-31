# @jourg/graph

`@jourg/graph` implements the current UJG Graph Editor's Draft from <https://ujg.specs.openuji.org/ed/graph> on top of the Core `UJGDocument.nodes` shape.

It expects Graph ED nodes to be stored in `UJGDocument.nodes` using the schema shown in the spec appendix:

- `@type: "UJGDocument"` on the document
- `nodes: [...]` for contained graph nodes
- `@type` / `@id` on graph nodes
- string IRI references for `startState`, `stateRefs`, `transitionRefs`, `outgoingTransitionGroupRefs`, `outgoingTransitionRefs`, `from`, `to`, and `subjourneyId`

## API

```ts
import {
  createGraphIndex,
  materializeJourney,
  validateGraph
} from "@jourg/graph";

const index = createGraphIndex([
  { source: "main-site.jsonld", document: mainDocument },
  { source: "checkout.jsonld", document: checkoutDocument }
]);

const validation = validateGraph(index);
const journey = materializeJourney(index, "urn:ujg:journey:main-site");
```

`materializeJourney()` returns the selected journey plus:

- member and referenced state nodes needed for rendering
- effective explicit and injected edges
- deduplicated explicit/injected overlaps with origin metadata
