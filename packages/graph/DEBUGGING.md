# Graph Compiler Debugging

## Source to Graph IR

`compileGraphIR()` in `packages/graph/src/compiler.ts` moves loaded source through a fixed set of stage values:

1. `prepareSourceInput()` in `packages/graph/src/internal/source.ts`
   Converts CLI or API input into a `PreparedSourceInput` with an `entryUrl` and ordered loaders.
2. `resolveSources()` in `packages/graph/src/internal/resolve.ts`
   Calls loaders, parses each `LoadedGraphSource`, normalizes relative imports against the current URL, and records loader provenance in `ResolvedDocument`.
3. `validateCore()` in `packages/graph/src/internal/validate-core.ts`
   Verifies top-level UJG document shape, required contexts, spec-version compatibility, extension payloads, and duplicate `@id` values.
4. `extractGraph()` in `packages/graph/src/internal/extract-graph.ts`
   Walks `document.normalizedDocument.nodes`, recognizes graph node types, and converts JSON objects into typed entities plus lookup maps.
5. `validateGraph()` in `packages/graph/src/internal/validate-graph.ts`
   Resolves graph references by `@id`, enforces expected target types, and checks that `transitionRefs` stay within a journey's `stateRefs`.
6. `injectJourneys()` in `packages/graph/src/internal/inject.ts`
   Expands outgoing transition groups into effective per-journey edges and merges them with explicit transitions.
7. `emitGraphIR()` in `packages/graph/src/internal/ir.ts`
   Clones the validated stage values into the public `GraphIR` shape.

The internal stage types that connect those stages live in `packages/graph/src/internal/state.ts`.

## Breakpoint Map

For the fastest pass through the stack, start with these breakpoints:

- `packages/graph/src/compiler.ts`
  Stop on each stage transition in `compileGraphIR()`.
- `packages/graph/src/internal/resolve.ts`
  Stop at `const loaded = await loadWithLoaders(...)` to inspect raw `LoadedGraphSource`.
- `packages/graph/src/internal/resolve.ts`
  Stop at `const normalizedDocument = normalizeImports(...)` to compare raw imports against normalized file URLs.
- `packages/graph/src/internal/extract-graph.ts`
  Stop at `const entity = normalizeGraphNode(...)` to see JSON nodes become typed graph entities.
- `packages/graph/src/internal/validate-graph.ts`
  Stop in `expectStateLike()` or `expectType()` to inspect failed and successful reference lookups.
- `packages/graph/src/internal/inject.ts`
  Stop in `mergeEdge()` to watch explicit and injected edges collapse into journey-level edges.
- `packages/graph/src/internal/ir.ts`
  Stop in `emitGraphIR()` to inspect the final public payload before it is returned.

## VS Code

This repo now includes three launch configurations in `.vscode/launch.json`:

- `jourg: compile fixture (tsx dev)`
  Runs `packages/jourg/src/index.ts` through `tsx` with the `development` package condition, so `@jourg/graph` and `@jourg/spec-sync` resolve to `src` instead of `dist`.

- `jourg: compile fixture (imports)`
  Happy-path file fixture that exercises file loading, relative import normalization, extraction, graph validation, and outgoing-transition injection.
- `jourg: compile fixture (invalid refs)`
  Broken graph references that fail in `validateGraph()`.
- `jourg: compile fixture (cycle)`
  Import cycle fixture that fails in `resolveSources()`.

Each launch config runs the built CLI entrypoint in `packages/jourg/dist/index.js` and uses source maps from `packages/*/dist/**/*.js`, so breakpoints placed in `packages/graph/src/**/*.ts` resolve back to TypeScript.

Before launching, VS Code runs the `build graph + cli` task from `.vscode/tasks.json`.
The `tsx dev` launch config does not need a build step.

## Fixtures

The file fixtures live under `packages/graph/fixtures/`:

- `imports/`
  Multi-document happy path with a subjourney import and a mixed explicit/injected edge.
- `invalid/`
  Minimal graph-reference failure case.
- `cycle/`
  Two documents that import each other.

You can also run them directly after building:

```bash
node packages/jourg/dist/index.js compile packages/graph/fixtures/imports/entry.jsonld --json
node packages/jourg/dist/index.js compile packages/graph/fixtures/invalid/entry.jsonld
node packages/jourg/dist/index.js compile packages/graph/fixtures/cycle/a.jsonld
```

To run the real TypeScript sources without building first:

```bash
pnpm dev:cli compile packages/graph/fixtures/imports/entry.jsonld --json
```
