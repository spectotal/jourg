export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue | undefined;
}

export interface GraphDocument extends JsonObject {
  id?: string;
  "@id"?: string;
  type?: string;
  "@type"?: string;
  specVersion?: string;
  items?: JsonValue[];
}

export interface GraphDocumentInput {
  document: JsonObject;
  source?: string;
}

export type GraphItemType =
  | "Journey"
  | "State"
  | "CompositeState"
  | "Transition"
  | "OutgoingTransitionGroup"
  | "OutgoingTransition";

export interface GraphEntityBase {
  id: string;
  type: GraphItemType;
  source: string;
  raw: JsonObject;
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

export interface IndexedGraphDocument {
  source: string;
  document: GraphDocument;
  itemIds: string[];
}

export interface GraphDiagnostic {
  severity: "warning" | "error";
  code:
    | "DUPLICATE_ITEM_ID"
    | "GRAPH_REFERENCE_MISSING"
    | "GRAPH_REFERENCE_TYPE"
    | "INVALID_GRAPH_DOCUMENT"
    | "INVALID_GRAPH_ITEM"
    | "JOURNEY_NOT_FOUND";
  message: string;
  source?: string;
  itemId?: string;
  path?: string;
  refId?: string;
  expectedType?: GraphItemType | "StateLike";
}

export interface GraphValidationResult {
  ok: boolean;
  diagnostics: GraphDiagnostic[];
}

export interface GraphIndex {
  documents: IndexedGraphDocument[];
  items: Map<string, GraphEntity>;
  journeys: Map<string, JourneyEntity>;
  states: Map<string, StateEntity>;
  compositeStates: Map<string, CompositeStateEntity>;
  transitions: Map<string, TransitionEntity>;
  outgoingTransitionGroups: Map<string, OutgoingTransitionGroupEntity>;
  outgoingTransitions: Map<string, OutgoingTransitionEntity>;
  diagnostics: GraphDiagnostic[];
}

export interface EffectiveEdgeOrigin {
  kind: "explicit" | "injected";
  transitionId?: string;
  groupId?: string;
  outgoingTransitionId?: string;
  label?: string;
}

export interface MaterializedJourneyNode {
  id: string;
  type: "State" | "CompositeState";
  label: string;
  tags: string[];
  membership: "member" | "referenced";
  isStartState: boolean;
  subjourneyId?: string;
  source: string;
}

export interface MaterializedJourneyEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  kind: "explicit" | "injected" | "mixed";
  origins: EffectiveEdgeOrigin[];
}

export interface MaterializedJourneyGraph {
  journey: JourneyEntity | null;
  nodes: MaterializedJourneyNode[];
  edges: MaterializedJourneyEdge[];
  diagnostics: GraphDiagnostic[];
}
