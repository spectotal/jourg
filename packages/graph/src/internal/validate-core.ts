import { GRAPH_COMPACT_TERMS, GRAPH_CONTEXT_URLS } from "@jourg/spec-sync";

import {
  isJsonObject,
  looksLikeExtensionNamespace
} from "./common.js";
import type { GraphCompileOptions, GraphDiagnostic, JsonValue, UJGDocument } from "../types.js";
import type { CoreValidatedBundle, IdentifiedEntity, ResolvedBundle, ResolvedDocument } from "./state.js";
const GRAPH_COMPACT_TERM_SET = new Set<string>(GRAPH_COMPACT_TERMS);

export function validateCoreBundle(
  bundle: ResolvedBundle,
  options: GraphCompileOptions
): CoreValidatedBundle {
  const diagnostics = [...bundle.diagnostics];
  const identifiedEntities: IdentifiedEntity[] = [];
  const entryDocument = bundle.documents.find((document) => document.source === bundle.entry) ?? null;

  for (const document of bundle.documents) {
    validateDocumentShape(document, diagnostics);
    collectIdentifiedEntities(document, identifiedEntities);
  }

  validateSpecVersionCompatibility(bundle.documents, entryDocument, diagnostics, options);
  validateDuplicateIds(identifiedEntities, diagnostics);

  return {
    ...bundle,
    entryDocument,
    identifiedEntities,
    diagnostics
  };
}

function validateDocumentShape(document: ResolvedDocument, diagnostics: GraphDiagnostic[]) {
  const value = document.normalizedDocument;

  if (value["@type"] !== "UJGDocument") {
    diagnostics.push({
      severity: "error",
      code: "INVALID_DOCUMENT",
      message: 'Resolved document must declare "@type": "UJGDocument".',
      source: document.source,
      path: "$.@type"
    });
  }

  if (typeof value.specVersion !== "string" || value.specVersion.length === 0) {
    diagnostics.push({
      severity: "error",
      code: "INVALID_DOCUMENT",
      message: "Resolved document must include a non-empty string specVersion.",
      source: document.source,
      path: "$.specVersion"
    });
  }

  validateContextComposition(value, document.source, diagnostics);

  if ("extensions" in value) {
    diagnostics.push({
      severity: "error",
      code: "DOCUMENT_EXTENSIONS_NOT_ALLOWED",
      message: "extensions MUST NOT appear on UJGDocument.",
      source: document.source,
      path: "$.extensions"
    });
  }

  if ("imports" in value && !Array.isArray(value.imports)) {
    diagnostics.push({
      severity: "error",
      code: "INVALID_IMPORT",
      message: "imports must be an array of IRI-reference strings.",
      source: document.source,
      path: "$.imports"
    });
  }

  if ("nodes" in value && !Array.isArray(value.nodes)) {
    diagnostics.push({
      severity: "error",
      code: "INVALID_DOCUMENT",
      message: "nodes must be an array when present.",
      source: document.source,
      path: "$.nodes"
    });
  }

  if (!Array.isArray(value.nodes)) {
    return;
  }

  for (const [index, nodeValue] of value.nodes.entries()) {
    if (!isJsonObject(nodeValue) || !("extensions" in nodeValue)) {
      continue;
    }

    const extensionPath = `$.nodes[${index}].extensions`;
    const extensionsValue = nodeValue.extensions;

    if (!isJsonObject(extensionsValue)) {
      diagnostics.push({
        severity: "error",
        code: "INVALID_EXTENSION_PAYLOAD",
        message: "If present, extensions MUST be a JSON object.",
        source: document.source,
        path: extensionPath
      });
      continue;
    }

    for (const [namespace, nested] of Object.entries(extensionsValue)) {
      if (!isJsonObject(nested)) {
        diagnostics.push({
          severity: "error",
          code: "INVALID_EXTENSION_PAYLOAD",
          message: "Each top-level extensions value MUST be a JSON object.",
          source: document.source,
          path: `${extensionPath}.${namespace}`
        });
        continue;
      }

      if (!looksLikeExtensionNamespace(namespace)) {
        diagnostics.push({
          severity: "warning",
          code: "EXTENSION_NAMESPACE_FORMAT",
          message:
            "Extension namespace should use reverse-DNS or URI-style ownership to avoid collisions.",
          source: document.source,
          path: `${extensionPath}.${namespace}`
        });
      }
    }
  }
}

function validateContextComposition(
  document: UJGDocument,
  source: string,
  diagnostics: GraphDiagnostic[]
) {
  const contextUrls = new Set(extractContextUrls(document["@context"]));

  if (
    !contextUrls.has(GRAPH_CONTEXT_URLS.core) &&
    !contextUrls.has(GRAPH_CONTEXT_URLS.aggregate)
  ) {
    diagnostics.push({
      severity: "error",
      code: "INVALID_DOCUMENT",
      message:
        "Compact UJG documents must include the published Core JSON-LD context URL.",
      source,
      path: "$.@context",
      expectedType: "PublishedContext"
    });
  }

  if (
    documentUsesGraphTerms(document) &&
    !contextUrls.has(GRAPH_CONTEXT_URLS.graph) &&
    !contextUrls.has(GRAPH_CONTEXT_URLS.aggregate)
  ) {
    diagnostics.push({
      severity: "error",
      code: "INVALID_DOCUMENT",
      message:
        "Documents using Graph terms must include the published Graph JSON-LD context URL or the aggregate context URL.",
      source,
      path: "$.@context",
      expectedType: "PublishedContext"
    });
  }
}

function validateSpecVersionCompatibility(
  documents: readonly ResolvedDocument[],
  entryDocument: ResolvedDocument | null,
  diagnostics: GraphDiagnostic[],
  options: GraphCompileOptions
) {
  const entryVersion = entryDocument?.normalizedDocument.specVersion;

  if (typeof entryVersion !== "string") {
    return;
  }

  const policy = options.specVersionPolicy ?? "strict";

  for (const document of documents) {
    const candidate = document.normalizedDocument.specVersion;

    if (typeof candidate !== "string") {
      continue;
    }

    const compatible =
      policy === "entry-major"
        ? getMajorVersion(candidate) === getMajorVersion(entryVersion)
        : candidate === entryVersion;

    if (!compatible) {
      diagnostics.push({
        severity: "error",
        code: "SPEC_VERSION_MISMATCH",
        message: `specVersion ${candidate} in ${document.source} is incompatible with entry specVersion ${entryVersion}.`,
        source: document.source,
        path: "$.specVersion"
      });
    }
  }
}

function validateDuplicateIds(entities: readonly IdentifiedEntity[], diagnostics: GraphDiagnostic[]) {
  const idIndex = new Map<string, IdentifiedEntity[]>();

  for (const entity of entities) {
    const matches = idIndex.get(entity.id) ?? [];
    matches.push(entity);
    idIndex.set(entity.id, matches);
  }

  for (const [id, matches] of idIndex) {
    if (matches.length < 2) {
      continue;
    }

    diagnostics.push({
      severity: "error",
      code: "DUPLICATE_ID",
      message: `Duplicate @id ${id} was found in multiple documents or locations.`,
      source: matches[0]?.source,
      entityId: id
    });
  }
}

function collectIdentifiedEntities(document: ResolvedDocument, entities: IdentifiedEntity[]) {
  const value = document.normalizedDocument;
  const documentId = typeof value["@id"] === "string" ? value["@id"] : undefined;

  if (documentId) {
    entities.push({
      id: documentId,
      kind: "document",
      source: document.source,
      path: "$"
    });
  }

  if (!Array.isArray(value.nodes)) {
    return;
  }

  for (const [index, nodeValue] of value.nodes.entries()) {
    if (!isJsonObject(nodeValue) || typeof nodeValue["@id"] !== "string") {
      continue;
    }

    entities.push({
      id: nodeValue["@id"],
      kind: "node",
      source: document.source,
      path: `$.nodes[${index}]`
    });
  }
}

function extractContextUrls(value: JsonValue | undefined): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractContextUrls(item));
  }

  return [];
}

function documentUsesGraphTerms(document: UJGDocument): boolean {
  if (!Array.isArray(document.nodes)) {
    return false;
  }

  return document.nodes.some((node) => usesGraphTerms(node));
}

function usesGraphTerms(value: JsonValue | undefined): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => usesGraphTerms(item));
  }

  if (!isJsonObject(value)) {
    return false;
  }

  return Object.keys(value).some((key) => GRAPH_COMPACT_TERM_SET.has(key));
}

function getMajorVersion(version: string): string {
  return version.split(".")[0] ?? version;
}
