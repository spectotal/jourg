# jourg

> A [UJG (User Journey Graph)](https://ujg.specs.openuji.org/ed/architecture) implementation — computable user experience as a deterministic protocol.

`jourg` implements the UJG specification: a layered standard for representing, executing, and analyzing user journeys as structured graph data. The goal is a single source of truth for Designers, Developers, and Analysts — from intent definition through runtime observation to conformance measurement.

---

## Architecture → Packages

The UJG spec defines a **five-layer conceptual stack**. This monorepo maps each layer to a discrete package:

| Layer | Concern | Package |
|---|---|---|
| **Core** (Transport) | JSON-LD envelope; universal parseability | `@jourg/core` |
| **Graph** (Definition) | States, Transitions, Composition (sub-journey refs) | `@jourg/graph` |
| **Experience** (Semantic) | Steps, Touchpoints, Phases, Pain Points | `@jourg/experience` |
| **Runtime** (Execution) | Actual user paths as causal event chains | `@jourg/runtime` |
| **Mapping** (Conformance) | Intent vs reality; conversion metrics, friction points | `@jourg/mapping` |

Each package is independently publishable. The `jourg` CLI (`packages/jourg`) is the profile-aware entrypoint that composes them.

```
packages/
├── jourg/        # CLI — profile loader and command dispatcher
├── core/         # Layer 1: Transport — JSON-LD envelope & URI identity
├── graph/        # Layer 2: Definition — automata-style journey graph
├── experience/   # Layer 3: Semantic — qualitative UX intent as data
├── runtime/      # Layer 4: Execution — session event chains
└── mapping/      # Layer 5: Conformance — graph overlay & metrics
```

---

## Profiles

Not every tool needs every layer. Following the [UJG Profiles](https://ujg.specs.openuji.org/ed/profiles) approach, `jourg` ships **named capability sets** — profiles — that declare which layers a given use-case requires:

| Profile | Layers included | Use-case |
|---|---|---|
| `graph-core` | core + graph | Authoring & validating journey definitions |
| `graph-composition` | core + graph (with sub-journey refs) | Modular, reusable journey building |
| `runtime-basic` | core + graph + runtime | Recording live user paths |
| `runtime-mapped` | all layers | Full conformance: intent vs observed reality |

A profile is declared at the document level in the journey file and consumed by the CLI to load only the required packages. Extensions follow URI-namespaced conventions to prevent collision and support graceful degradation when a profile feature is absent.

---

## Guiding Principles

- **Graph First** — journeys are automata (states + transitions), not URL sequences
- **Stable Identity** — all entities are URI-identified, surviving architectural change
- **Separation of Concerns** — immutable journey definitions are distinct from ephemeral session instances
- **Vendor Neutrality** — this repo implements data structures, not a visualization framework

---

## Getting Started

```bash
# Install
pnpm install

# Build all packages
pnpm build

# Run the CLI
npx jourg help
```

---

## Status

Implementation of the [UJG W3C Community Group Draft](https://ujg.specs.openuji.org/ed/architecture) (last spec update: 2026-01-28). Currently implementing `graph-core` profile.
