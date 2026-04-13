# @jourg/resolver

`@jourg/resolver` is a working MVP for resolving `UJGDocument` imports on the consumer or producer side.

It implements the current UJG Core import rules from <https://ujg.specs.openuji.org/ed/core>:

- `imports` values are treated as IRI references
- relative imports resolve against the importing document location
- document-level `extensions` are invalid
- node-level `extensions` are preserved and validated as JSON objects
- unknown extensions never affect core identity, import resolution, or reference resolution

## What the MVP does

- resolves transitive imports from `file:` and `http(s):` sources
- normalizes imports to deterministic absolute URLs
- collects provenance and diagnostics for every resolved import edge
- materializes a flattened bundle of resolved documents and identified entities
- validates `specVersion` compatibility and duplicate `@id` collisions across documents
- supports opt-in extension handlers while defaulting official extensions to preserve-only mode

## API

```ts
import {
  normalizeImports,
  resolveDocument,
  validateBundle
} from "@jourg/resolver";

const bundle = await resolveDocument("journeys/checkout.jsonld", {
  mode: "consumer"
});

const normalized = normalizeImports(bundle.documents[0].document, new URL(bundle.entry));
const validation = validateBundle(bundle);
```

### `resolveDocument(entry, options)`

Loads an entry document, resolves transitive imports, and returns:

- `documents`: per-document source, normalized document, import edges, and document diagnostics
- `imports`: all resolved import edges with status and loader provenance
- `materialized`: cloned resolved documents plus flattened identified entities
- `validation`: aggregate bundle validation result
- `activeExtensionHandlers`: namespaces whose handlers ran successfully

### `normalizeImports(document, base)`

Returns a cloned document with deduplicated, sorted, absolute import URLs.

### `validateBundle(bundle, options?)`

Checks the resolved bundle for:

- Core document-shape violations already collected during load
- `specVersion` incompatibilities against the entry document
- duplicate `@id` collisions across different source documents

## Extension handling

The ED index currently lists these official optional extensions:

- Design System
- Routing
- Localization
- Accessibility
- Analytics
- Experimentation
- Privacy
- AI Runtime
- Forms
- Personalization

The MVP keeps all of them in preserve-only mode by default. You can register explicit namespace handlers when you want extra validation or materialization for a known extension.

## CLI

The workspace CLI exposes the resolver directly:

```bash
jourg resolve ./journeys/checkout.jsonld
jourg resolve ./journeys/checkout.jsonld --format json
jourg resolve https://example.com/ujg/entry.jsonld --mode producer
```

## Testing

```bash
pnpm --filter @jourg/resolver test
```
