import type {
  ResolverMode,
  ResolverPlanItem,
  SupportedExtensionPlan
} from "./types.js";

export const UJG_DOCUMENT_RESOLVER_PLAN: Record<ResolverMode, ResolverPlanItem[]> = {
  producer: [
    {
      id: "P1",
      milestone: "Authoring-time document normalization",
      deliverables: [
        "Accept relative and absolute `imports`",
        "Normalize output to canonical absolute IRIs for release artifacts",
        "Emit deterministic sorted import list",
        "Persist extension payloads without mutation in lossless mode"
      ],
      dependencies: ["@jourg/core"]
    },
    {
      id: "P2",
      milestone: "Publish-time graph integrity checks",
      deliverables: [
        "Detect duplicate @id collisions across imported documents",
        "Enforce specVersion compatibility policy",
        "Reject import cycles unless explicitly configured",
        "Validate extension namespace keys and object payload shape"
      ],
      dependencies: ["@jourg/core", "@jourg/graph"]
    }
  ],
  consumer: [
    {
      id: "C1",
      milestone: "Runtime import resolver",
      deliverables: [
        "Resolve relative imports against source document URL/file URL",
        "Load transitive imports via pluggable fetcher/file-loader",
        "Preserve provenance for each resolved edge",
        "Guarantee unknown extensions do not alter core import/reference resolution"
      ],
      dependencies: ["@jourg/core"]
    },
    {
      id: "C2",
      milestone: "Validation and materialization",
      deliverables: [
        "Validate merged graph against Core constraints",
        "Expose a fully materialized UJGDocument bundle",
        "Return rich diagnostics for unresolved imports and ID collisions",
        "Optionally execute registered extension handlers"
      ],
      dependencies: ["@jourg/core", "@jourg/runtime"]
    }
  ]
};

export const OFFICIAL_EXTENSION_SUPPORT_PLAN: SupportedExtensionPlan[] = [
  "Design System",
  "Routing",
  "Localization",
  "Accessibility",
  "Analytics",
  "Experimentation",
  "Privacy",
  "AI Runtime",
  "Forms",
  "Personalization"
].map((name) => ({
  name,
  spec: "https://ujg.specs.openuji.org/ed",
  support: {
    consumer: "preserve-only",
    producer: "preserve-only"
  },
  notes:
    "Default MVP policy preserves extension payloads and ignores unknown namespaces for core identity, import resolution, and reference resolution."
}));

