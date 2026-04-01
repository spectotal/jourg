export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue | undefined;
}

export interface ExtensionMap {
  [namespace: string]: JsonObject;
}

export interface UJGNode extends JsonObject {
  "@id"?: string;
  "@type"?: string;
  extensions?: ExtensionMap;
}

export interface UJGDocument extends JsonObject {
  "@context"?: JsonValue;
  "@id"?: string;
  "@type"?: string;
  specVersion?: string;
  imports?: string[];
  nodes?: JsonValue[];
  items?: JsonValue[];
  extensions?: JsonObject;
}

export interface LoadedGraphSource {
  document: UJGDocument;
  mediaType?: string;
}

export interface GraphIRLoader {
  name: string;
  canLoad(url: URL): boolean;
  load(url: URL): Promise<LoadedGraphSource>;
}

export interface GraphIRLocatorInput {
  kind: "locator";
  entry: string | URL;
}

export type GraphCompileInput = GraphIRLocatorInput;

export interface GraphCompileOptions {
  loaders?: readonly GraphIRLoader[];
  maxDepth?: number;
  allowCycles?: boolean;
  specVersionPolicy?: "strict" | "entry-major";
}

export type GraphNodeType =
  | "Journey"
  | "State"
  | "CompositeState"
  | "Transition"
  | "OutgoingTransitionGroup"
  | "OutgoingTransition";

export interface GraphEntityBase {
  id: string;
  type: GraphNodeType;
  source: string;
  path: string;
}

export interface JourneyEntity extends GraphEntityBase {
  type: "Journey";
  startState: string;
  stateRefs: string[];
  transitionRefs: string[];
  outgoingTransitionGroupRefs: string[];
}

export interface StateEntity extends GraphEntityBase {
  type: "State";
  label: string;
  tags: string[];
}

export interface CompositeStateEntity extends GraphEntityBase {
  type: "CompositeState";
  label: string;
  tags: string[];
  subjourneyId: string;
}

export interface TransitionEntity extends GraphEntityBase {
  type: "Transition";
  from: string;
  to: string;
  label?: string;
}

export interface OutgoingTransitionGroupEntity extends GraphEntityBase {
  type: "OutgoingTransitionGroup";
  outgoingTransitionRefs: string[];
}

export interface OutgoingTransitionEntity extends GraphEntityBase {
  type: "OutgoingTransition";
  to: string;
  label?: string;
}

export type StateLikeEntity = StateEntity | CompositeStateEntity;
export type GraphEntity =
  | JourneyEntity
  | StateEntity
  | CompositeStateEntity
  | TransitionEntity
  | OutgoingTransitionGroupEntity
  | OutgoingTransitionEntity;

export interface GraphDiagnostic {
  severity: "warning" | "error";
  code:
    | "CYCLE_DETECTED"
    | "DOCUMENT_EXTENSIONS_NOT_ALLOWED"
    | "DUPLICATE_ID"
    | "EXTENSION_NAMESPACE_FORMAT"
    | "INVALID_DOCUMENT"
    | "INVALID_EXTENSION_PAYLOAD"
    | "INVALID_IMPORT"
    | "LOAD_FAILED"
    | "MAX_DEPTH_EXCEEDED"
    | "SPEC_VERSION_MISMATCH"
    | "GRAPH_REFERENCE_MISSING"
    | "GRAPH_REFERENCE_TYPE"
    | "GRAPH_JOURNEY_TRANSITION_MEMBERSHIP"
    | "INVALID_GRAPH_NODE";
  message: string;
  source?: string;
  path?: string;
  entityId?: string;
  refId?: string;
  importRef?: string;
  resolvedImport?: string;
  expectedType?: GraphNodeType | "StateLike" | "PublishedContext";
  actualType?: string;
}

export interface GraphIRDocumentImport {
  from: string;
  request: string;
  resolved: string | null;
  status: "resolved" | "unresolved" | "cycle" | "invalid";
  via?: string;
}

export interface GraphIRDocument {
  source: string;
  loader: string;
  documentId?: string;
  specVersion?: string;
  normalizedImports: string[];
  imports: GraphIRDocumentImport[];
}

export interface GraphIRJourneyEdgeOrigin {
  kind: "explicit" | "injected";
  source: string;
  transitionId?: string;
  groupId?: string;
  outgoingTransitionId?: string;
  label?: string;
}

export interface GraphIRJourneyEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  kind: "explicit" | "injected" | "mixed";
  origins: GraphIRJourneyEdgeOrigin[];
}

export interface GraphIRJourney {
  id: string;
  source: string;
  startStateId: string;
  memberStateIds: string[];
  includedStateIds: string[];
  nodeIds: string[];
  edges: GraphIRJourneyEdge[];
}

export interface GraphIREntities {
  journeys: JourneyEntity[];
  states: StateEntity[];
  compositeStates: CompositeStateEntity[];
  transitions: TransitionEntity[];
  outgoingTransitionGroups: OutgoingTransitionGroupEntity[];
  outgoingTransitions: OutgoingTransitionEntity[];
}

export interface GraphIR {
  kind: "GraphIR";
  entry: string;
  specVersion: string;
  warnings: GraphDiagnostic[];
  documents: GraphIRDocument[];
  entities: GraphIREntities;
  journeys: GraphIRJourney[];
}
