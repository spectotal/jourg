# @jourg/graph

`@jourg/graph` compiles compact UJG documents into bundle-level Graph IR.

The compiler pipeline is:

- load source
- resolve imports
- validate Core
- extract Graph entities
- validate Graph references
- inject outgoing transition groups
- emit Graph IR

## API

```ts
import { compileGraphIR } from "@jourg/graph";

const graph = await compileGraphIR({
  kind: "locator",
  entry: "https://example.com/main.jsonld"
});
```

`compileGraphIR()` throws `GraphCompileError` when any error-level diagnostic is present. On success it returns:

- `documents`: resolved source provenance and normalized imports
- `entities`: canonical journeys, states, transitions, outgoing groups, and outgoing transitions
- `journeys`: compiled per-journey views with injected effective edges
- `warnings`: non-fatal diagnostics such as malformed extension namespaces

The compiler accepts:

- locator input: `{ kind: "locator", entry }`
