import type { GraphDiagnostic, GraphIR } from "../types.js";
import type { InjectedGraphBundle } from "./state.js";

export function emitGraphIR(
  bundle: InjectedGraphBundle,
  diagnostics: readonly GraphDiagnostic[]
): GraphIR {
  return {
    kind: "GraphIR",
    entry: bundle.entry,
    specVersion: bundle.entryDocument?.normalizedDocument.specVersion ?? "",
    warnings: diagnostics.filter((diagnostic) => diagnostic.severity === "warning"),
    documents: bundle.documents.map((document) => ({
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
      journeys: bundle.entities.journeys.map((entity) => ({ ...entity })),
      states: bundle.entities.states.map((entity) => ({ ...entity })),
      compositeStates: bundle.entities.compositeStates.map((entity) => ({ ...entity })),
      transitions: bundle.entities.transitions.map((entity) => ({ ...entity })),
      outgoingTransitionGroups: bundle.entities.outgoingTransitionGroups.map((entity) => ({ ...entity })),
      outgoingTransitions: bundle.entities.outgoingTransitions.map((entity) => ({ ...entity }))
    },
    journeys: bundle.journeys.map((journey) => ({
      ...journey,
      memberStateIds: [...journey.memberStateIds],
      includedStateIds: [...journey.includedStateIds],
      nodeIds: [...journey.nodeIds],
      edges: journey.edges.map((edge) => ({
        ...edge,
        origins: edge.origins.map((origin) => ({ ...origin }))
      }))
    }))
  };
}
