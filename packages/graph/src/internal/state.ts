import type {
  GraphDiagnostic,
  GraphEntity,
  GraphIRDocumentImport,
  GraphIREntities,
  GraphIRJourney,
  GraphIRLoader,
  UJGDocument
} from "../types.js";

export interface PreparedSourceInput {
  entryUrl: URL;
  loaders: GraphIRLoader[];
}

export interface ResolvedDocument {
  source: string;
  loader: string;
  normalizedDocument: UJGDocument;
  imports: GraphIRDocumentImport[];
}

export interface IdentifiedEntity {
  id: string;
  kind: "document" | "node";
  source: string;
  path: string;
}

export interface ResolvedBundle {
  entry: string;
  documents: ResolvedDocument[];
  diagnostics: GraphDiagnostic[];
}

export interface CoreValidatedBundle extends ResolvedBundle {
  entryDocument: ResolvedDocument | null;
  identifiedEntities: IdentifiedEntity[];
}

export interface ExtractedGraphBundle extends CoreValidatedBundle {
  entities: GraphIREntities;
  nodeMap: Map<string, GraphEntity>;
  journeyMap: Map<string, GraphIREntities["journeys"][number]>;
  stateMap: Map<string, GraphIREntities["states"][number]>;
  compositeStateMap: Map<string, GraphIREntities["compositeStates"][number]>;
  transitionMap: Map<string, GraphIREntities["transitions"][number]>;
  outgoingTransitionGroupMap: Map<string, GraphIREntities["outgoingTransitionGroups"][number]>;
  outgoingTransitionMap: Map<string, GraphIREntities["outgoingTransitions"][number]>;
}

export interface InjectedGraphBundle extends ExtractedGraphBundle {
  journeys: GraphIRJourney[];
}
