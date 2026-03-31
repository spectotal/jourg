# @jourg/resolver

Planning package for a consumer/producer-side resolver around `UJGDocument` import semantics.

## Why this package

UJG Core defines import behavior but intentionally does not define workspace/package roots. This package codifies a resolver strategy for monorepo producer workflows and runtime consumer workflows while preserving Core conformance.

## Inputs from UJG Core spec

From <https://ujg.specs.openuji.org/ed/core> (Editor's Draft):

- `imports` values **must** be IRI references.
- `imports` may be absolute IRIs or relative IRI references.
- Relative imports must resolve against the location of the importing `UJGDocument`.
- For HTTP(S), base is the document URL; for file URLs, base is importing file URL.
- Core does not define manifest root/package root/workspace root.
- Extension data is optional and must not change core import/reference semantics unless explicitly implemented by a consumer/producer extension module.

## Supported extension strategy

From the **Supported Extensions** block on <https://ujg.specs.openuji.org/ed>, official optional extensions include:

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

Resolver policy for these extensions in phase 1:

1. **Preserve-by-default:** keep extension payloads round-trippable in producer and consumer paths.
2. **Isolation from core:** extension keys cannot alter core import resolution, IRI identity, or base-URL behavior.
3. **Opt-in handlers:** extension-specific validation/materialization occurs only via registered handlers.
4. **Capability reporting:** resolver output exposes which official extension handlers were active.

## Package scope

### Producer side

Used during authoring/publishing to normalize and validate document sets before distribution:

1. Normalize import declarations.
2. Expand and validate import graph.
3. Emit deterministic artifacts.

### Consumer side

Used during runtime/analysis ingestion to resolve and materialize UJG bundles:

1. Resolve direct and transitive imports.
2. Track provenance and resolution diagnostics.
3. Validate assembled bundle against Core constraints.

## Proposed API surface (phase 1)

```ts
resolveDocument(entry: URL, options): Promise<ResolvedBundle>
normalizeImports(document: UJGDocument, base: URL): UJGDocument
validateBundle(bundle: ResolvedBundle): ValidationResult
```

## Delivery plan

### Milestone 1 — Resolver kernel

- URL/file relative-resolution engine (RFC3986-aligned behavior through URL APIs).
- Pluggable loaders (`http`, `file`, custom).
- Cycle detection + depth limits.

### Milestone 2 — Producer pipeline

- Canonicalization policy for publish artifacts.
- Stable ordering and deterministic serialization.
- Compatibility gates for `specVersion`.
- Extension namespace and payload-shape checks (without semantic rewriting).

### Milestone 3 — Consumer materialization

- Merge semantics for imported nodes.
- Provenance map for every resolved unit.
- Diagnostics model (`warning`, `error`, `source`, `importPath`).
- Optional execution of registered official extension handlers.

### Milestone 4 — CLI integration

- `jourg resolve <entry>` command.
- `--mode consumer|producer` presets.
- Machine-readable output for CI.

## Non-goals (phase 1)

- Remote context rewriting.
- Full profile-specific semantic validation beyond Core.
- Caching/distributed fetch coordination.
- Implicit semantic behavior for extensions without an explicit handler.
