import type { GraphDiagnostic, GraphIR } from "../types.js";
import type {
  CoreValidation,
  ExtractedEntities,
  InjectedJourneys,
  ResolvedSources
} from "./state.js";

export function emitGraphIR(
  resolved: ResolvedSources,
  core: CoreValidation,
  entities: ExtractedEntities,
  injected: InjectedJourneys,
  diagnostics: readonly GraphDiagnostic[]
): GraphIR {
  return {
    kind: "GraphIR",
    entry: resolved.entry,
    specVersion: core.entryDocument?.normalizedDocument.specVersion ?? "",
    warnings: diagnostics.filter((diagnostic) => diagnostic.severity === "warning"),
    documents: resolved.documents.map((document) => ({
      source: document.source,
      loader: document.loader,
      documentId:
        typeof document.normalizedDocument["@id"] === "string"
          ? document.normalizedDocument["@id"]
          : undefined,
      specVersion: document.normalizedDocument.specVersion,
      normalizedImports: Array.isArray(document.normalizedDocument.imports)
        ? [...document.normalizedDocument.imports]
        : [],
      imports: document.imports.map((item) => ({ ...item }))
    })),
    entities: {
      journeys: entities.journeys.map((entity) => ({ ...entity })),
      states: entities.states.map((entity) => ({ ...entity })),
      compositeStates: entities.compositeStates.map((entity) => ({ ...entity })),
      transitions: entities.transitions.map((entity) => ({ ...entity })),
      outgoingTransitionGroups: entities.outgoingTransitionGroups.map((entity) => ({ ...entity })),
      outgoingTransitions: entities.outgoingTransitions.map((entity) => ({ ...entity }))
    },
    journeys: injected.journeys.map((journey) => ({
      ...journey,
      memberStateIds: [...journey.memberStateIds],
      includedStateIds: [...journey.includedStateIds],
      edges: journey.edges.map((edge) => ({
        ...edge,
        origins: edge.origins.map((origin) => ({ ...origin }))
      }))
    }))
  };
}
