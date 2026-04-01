# jourg

> A [UJG (User Journey Graph)](https://ujg.specs.openuji.org/ed/architecture) implementation focused on compiling compact UJG documents into Graph IR.

`jourg` currently implements a Graph-first compiler pipeline: compact UJG documents go through import resolution, Core/Graph validation, outgoing-transition injection, and end up as Graph IR that apps can visualize or consume.

---

## Current Workspace

The UJG specification defines a broader multi-layer architecture. This workspace currently implements the Graph compiler core:

| Package | Concern |
|---|---|
| `@jourg/graph` | UJG to Graph IR compiler |
| `@jourg/spec-sync` | Synced Core/Graph vocab, context, and shape artifacts |
| `jourg` | CLI wrapper around `@jourg/graph` |
| `ujg-graph-playground` | Browser playground that compiles pasted documents in memory |

`jourg compile` is the main entrypoint today.

```text
apps/
└── graph-playground/ # React Flow playground for pasted UJG documents compiled to Graph IR

packages/
├── jourg/        # CLI — compile UJG documents to Graph IR
├── graph/        # Compiler pipeline — resolve/import/validate/inject -> Graph IR
└── spec-sync/    # Internal synced spec artifacts
```

---

## Profiles

Not every tool needs every UJG layer. The current workspace is intentionally narrower than the full conceptual stack and targets the graph profile first:

| Profile | Capability | Use-case |
|---|---|---|
| `graph-core` | compact UJG -> Graph IR | Authoring, validating, and visualizing journey definitions |
| `graph-composition` | graph-core + subjourney refs | Modular journey building |

Future UJG layers remain planned, but are not implemented in this workspace yet.

---

## Guiding Principles

- **Graph First** — journeys are automata (states + transitions), not URL sequences
- **Stable Identity** — all entities are URI-identified, surviving architectural change
- **Separation of Concerns** — immutable journey definitions are distinct from compiled IR
- **Vendor Neutrality** — this repo implements data structures and compiler stages, not a visualization framework

---

## Getting Started

```bash
# Install
pnpm install

# Build all packages
pnpm build

# Run the CLI
npx jourg help
npx jourg compile ./journeys/entry.jsonld
```

---

## Status

Implementation of the [UJG W3C Community Group Draft](https://ujg.specs.openuji.org/ed/architecture) (last spec update: 2026-04-01). The current codebase implements a strict Graph compiler pipeline and Graph IR playground on top of synced Core and Graph spec artifacts.
