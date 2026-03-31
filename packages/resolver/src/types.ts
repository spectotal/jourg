export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue | undefined;
}

export type ResolverMode = "consumer" | "producer";
export type ExtensionSupportLevel = "preserve-only" | "validate" | "materialize";

export interface ResolverPlanItem {
  id: string;
  milestone: string;
  deliverables: string[];
  dependencies: string[];
}

export interface SupportedExtensionPlan {
  name: string;
  spec: string;
  support: {
    consumer: ExtensionSupportLevel;
    producer: ExtensionSupportLevel;
  };
  notes: string;
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

export interface ResolverDiagnostic {
  severity: "warning" | "error";
  code:
    | "CYCLE_DETECTED"
    | "DOCUMENT_EXTENSIONS_NOT_ALLOWED"
    | "DUPLICATE_ID"
    | "EXTENSION_HANDLER_FAILED"
    | "EXTENSION_NAMESPACE_FORMAT"
    | "INVALID_DOCUMENT"
    | "INVALID_EXTENSION_PAYLOAD"
    | "INVALID_IMPORT"
    | "LOAD_FAILED"
    | "MAX_DEPTH_EXCEEDED"
    | "SPEC_VERSION_MISMATCH";
  message: string;
  source?: string;
  path?: string;
  importRef?: string;
  resolvedImport?: string;
}

export interface ValidationResult {
  ok: boolean;
  diagnostics: ResolverDiagnostic[];
}

export interface ResolvedImport {
  from: string;
  request: string;
  resolved: string | null;
  status: "resolved" | "unresolved" | "cycle" | "invalid";
  via?: string;
}

export interface ResolvedDocument {
  source: string;
  loader: string;
  document: UJGDocument;
  normalizedDocument: UJGDocument;
  imports: ResolvedImport[];
  diagnostics: ResolverDiagnostic[];
}

export interface MaterializedEntity {
  id: string;
  kind: "document" | "node";
  source: string;
  path: string;
  value: JsonObject;
}

export interface MaterializedBundle {
  entryDocument?: UJGDocument;
  documents: UJGDocument[];
  entities: MaterializedEntity[];
}

export interface ResolvedBundle {
  entry: string;
  mode: ResolverMode;
  documents: ResolvedDocument[];
  imports: ResolvedImport[];
  diagnostics: ResolverDiagnostic[];
  validation: ValidationResult;
  materialized: MaterializedBundle;
  activeExtensionHandlers: string[];
  officialExtensionSupport: SupportedExtensionPlan[];
}

export interface LoadedDocumentSource {
  document: UJGDocument;
  mediaType?: string;
}

export interface ResolverLoader {
  name: string;
  canLoad(url: URL): boolean;
  load(url: URL): Promise<LoadedDocumentSource>;
}

export interface ExtensionHandlerContext {
  bundleMode: ResolverMode;
  namespace: string;
  source: string;
  path: string;
  node: JsonObject;
  extension: JsonObject;
}

export interface ExtensionHandler {
  namespace: string;
  support: ExtensionSupportLevel;
  handle(context: ExtensionHandlerContext): void | Promise<void>;
}

export interface ResolveOptions {
  mode?: ResolverMode;
  loaders?: ResolverLoader[];
  maxDepth?: number;
  allowCycles?: boolean;
  extensionHandlers?: ExtensionHandler[];
  specVersionPolicy?: "strict" | "entry-major";
}
