import type {
  CompositeStateEntity,
  GraphDiagnostic,
  GraphEntity,
  GraphIRDocumentImport,
  GraphIRJourney,
  GraphIRLoader,
  JourneyEntity,
  OutgoingTransitionEntity,
  OutgoingTransitionGroupEntity,
  StateEntity,
  StateLikeEntity,
  TransitionEntity,
  UJGDocument
} from "../types.js";

export interface StageResult<T> {
  readonly value: T;
  readonly diagnostics: readonly GraphDiagnostic[];
}

export interface PreparedSourceInput {
  readonly entryUrl: URL;
  readonly loaders: readonly GraphIRLoader[];
}

export interface ResolvedDocument {
  readonly source: string;
  readonly loader: string;
  readonly normalizedDocument: UJGDocument;
  readonly imports: readonly GraphIRDocumentImport[];
}

export interface IdentifiedEntity {
  readonly id: string;
  readonly kind: "document" | "node";
  readonly source: string;
  readonly path: string;
}

export interface ResolvedSources {
  readonly entry: string;
  readonly documents: readonly ResolvedDocument[];
}

export interface CoreValidation {
  readonly entryDocument: ResolvedDocument | null;
  readonly identifiedEntities: readonly IdentifiedEntity[];
}

export interface ExtractedEntities {
  readonly journeys: readonly JourneyEntity[];
  readonly states: readonly StateEntity[];
  readonly compositeStates: readonly CompositeStateEntity[];
  readonly transitions: readonly TransitionEntity[];
  readonly outgoingTransitionGroups: readonly OutgoingTransitionGroupEntity[];
  readonly outgoingTransitions: readonly OutgoingTransitionEntity[];
}

export interface GraphEntityIndex {
  readonly byId: ReadonlyMap<string, GraphEntity>;
  readonly stateLikesById: ReadonlyMap<string, StateLikeEntity>;
  readonly journeysById: ReadonlyMap<string, JourneyEntity>;
  readonly transitionsById: ReadonlyMap<string, TransitionEntity>;
  readonly outgoingGroupsById: ReadonlyMap<string, OutgoingTransitionGroupEntity>;
  readonly outgoingTransitionsById: ReadonlyMap<string, OutgoingTransitionEntity>;
}

export interface ExtractedGraph {
  readonly entities: ExtractedEntities;
  readonly index: GraphEntityIndex;
}

export interface InjectedJourneys {
  readonly journeys: readonly GraphIRJourney[];
}
