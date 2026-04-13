import { readFile } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { OFFICIAL_EXTENSION_SUPPORT_PLAN } from "./constants.js";
import type {
  ExtensionHandler,
  ExtensionHandlerContext,
  JsonObject,
  JsonValue,
  LoadedDocumentSource,
  MaterializedBundle,
  MaterializedEntity,
  ResolveOptions,
  ResolvedBundle,
  ResolvedDocument,
  ResolvedImport,
  ResolverDiagnostic,
  ResolverLoader,
  ResolverMode,
  UJGDocument,
  ValidationResult
} from "./types.js";

const DEFAULT_MAX_DEPTH = 32;

export function createFileSystemLoader(): ResolverLoader {
  return {
    name: "file",
    canLoad(url) {
      return url.protocol === "file:";
    },
    async load(url) {
      const raw = await readFile(fileURLToPath(url), "utf8");
      return { document: parseDocument(raw, url.href), mediaType: "application/ld+json" };
    }
  };
}

export function createHttpLoader(fetchImpl: typeof fetch = fetch): ResolverLoader {
  return {
    name: "http",
    canLoad(url) {
      return url.protocol === "http:" || url.protocol === "https:";
    },
    async load(url) {
      const response = await fetchImpl(url, {
        headers: {
          accept: "application/ld+json, application/json;q=0.9, */*;q=0.1"
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
      }

      const raw = await response.text();

      return {
        document: parseDocument(raw, url.href),
        mediaType: response.headers.get("content-type") ?? undefined
      };
    }
  };
}

export function normalizeImports(document: UJGDocument, base: URL): UJGDocument {
  const normalized = cloneDocument(document);

  if (!Array.isArray(document.imports)) {
    return normalized;
  }

  const imports = document.imports
    .filter((value): value is string => typeof value === "string")
    .map((value) => {
      try {
        return new URL(value, base).href;
      } catch {
        return value;
      }
    });

  normalized.imports = Array.from(new Set(imports)).sort();

  return normalized;
}

export async function resolveDocument(
  entry: string | URL,
  options: ResolveOptions = {}
): Promise<ResolvedBundle> {
  const mode = options.mode ?? "consumer";
  const entryUrl = toDocumentUrl(entry);
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const allowCycles = options.allowCycles ?? false;
  const loaders = createLoaders(options.loaders ?? []);
  const handlerMap = new Map(
    (options.extensionHandlers ?? []).map((handler) => [handler.namespace, handler])
  );

  const documents = new Map<string, ResolvedDocument>();
  const imports: ResolvedImport[] = [];
  const diagnostics: ResolverDiagnostic[] = [];
  const activeHandlers = new Set<string>();

  const visit = async (url: URL, depth: number, ancestry: string[]): Promise<boolean> => {
    const source = url.href;

    if (depth > maxDepth) {
      diagnostics.push({
        severity: "error",
        code: "MAX_DEPTH_EXCEEDED",
        message: `Import depth exceeded the configured max depth of ${maxDepth}.`,
        source
      });
      return false;
    }

    if (documents.has(source)) {
      return true;
    }

    let loadedSource: LoadedDocumentSource;
    let loaderName: string;

    try {
      const loaded = await loadWithLoaders(url, loaders);
      loadedSource = loaded.source;
      loaderName = loaded.loader.name;
    } catch (error) {
      diagnostics.push({
        severity: "error",
        code: "LOAD_FAILED",
        message: `Failed to load ${source}: ${toErrorMessage(error)}`,
        source
      });
      return false;
    }

    if (!isJsonObject(loadedSource.document)) {
      diagnostics.push({
        severity: "error",
        code: "INVALID_DOCUMENT",
        message: "Resolved content is not a JSON object.",
        source
      });
      return false;
    }

    const document = loadedSource.document as UJGDocument;
    const normalizedDocument = normalizeImports(document, url);
    const documentDiagnostics = await validateDocumentShape(
      normalizedDocument,
      source,
      mode,
      handlerMap,
      activeHandlers
    );

    const resolvedDocument: ResolvedDocument = {
      source,
      loader: loaderName,
      document: cloneDocument(document),
      normalizedDocument,
      imports: [],
      diagnostics: documentDiagnostics
    };

    documents.set(source, resolvedDocument);

    if (!Array.isArray(document.imports)) {
      return true;
    }

    for (const request of document.imports) {
      const edge: ResolvedImport = {
        from: source,
        request: typeof request === "string" ? request : String(request),
        resolved: null,
        status: "invalid"
      };

      resolvedDocument.imports.push(edge);
      imports.push(edge);

      if (typeof request !== "string") {
        diagnostics.push({
          severity: "error",
          code: "INVALID_IMPORT",
          message: "imports values must be strings representing IRI references.",
          source,
          importRef: edge.request
        });
        continue;
      }

      let targetUrl: URL;

      try {
        targetUrl = new URL(request, url);
      } catch (error) {
        diagnostics.push({
          severity: "error",
          code: "INVALID_IMPORT",
          message: `Invalid import reference ${JSON.stringify(request)}: ${toErrorMessage(error)}`,
          source,
          importRef: request
        });
        continue;
      }

      edge.resolved = targetUrl.href;

      if (ancestry.includes(targetUrl.href) || targetUrl.href === source) {
        edge.status = "cycle";
        diagnostics.push({
          severity: "error",
          code: "CYCLE_DETECTED",
          message: `Import cycle detected: ${[...ancestry, source, targetUrl.href].join(" -> ")}`,
          source,
          importRef: request,
          resolvedImport: targetUrl.href
        });

        if (!allowCycles) {
          continue;
        }
      }

      const loaded = await visit(targetUrl, depth + 1, [...ancestry, source]);
      edge.status = loaded ? "resolved" : edge.status === "cycle" ? "cycle" : "unresolved";

      if (loaded) {
        edge.via = documents.get(targetUrl.href)?.loader;
      }
    }

    return true;
  };

  await visit(entryUrl, 0, []);

  const orderedDocuments = Array.from(documents.values()).sort((left, right) =>
    left.source.localeCompare(right.source)
  );

  const materialized = materializeBundle(entryUrl.href, orderedDocuments);
  const bundle: ResolvedBundle = {
    entry: entryUrl.href,
    mode,
    documents: orderedDocuments,
    imports,
    diagnostics: uniqueDiagnostics(diagnostics),
    validation: { ok: true, diagnostics: [] },
    materialized,
    activeExtensionHandlers: Array.from(activeHandlers).sort(),
    officialExtensionSupport: OFFICIAL_EXTENSION_SUPPORT_PLAN.map((plan) => ({ ...plan }))
  };

  bundle.validation = validateBundle(bundle, {
    specVersionPolicy: options.specVersionPolicy
  });

  return bundle;
}

export function validateBundle(
  bundle: ResolvedBundle,
  options: Pick<ResolveOptions, "specVersionPolicy"> = {}
): ValidationResult {
  const diagnostics = [
    ...bundle.diagnostics,
    ...bundle.documents.flatMap((document) => document.diagnostics)
  ];

  const entryDocument = bundle.materialized.entryDocument;
  const entryVersion = entryDocument?.specVersion;
  const policy = options.specVersionPolicy ?? "strict";

  if (typeof entryVersion === "string") {
    for (const document of bundle.documents) {
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
          source: document.source
        });
      }
    }
  }

  const idIndex = new Map<string, MaterializedEntity[]>();

  for (const entity of bundle.materialized.entities) {
    const matches = idIndex.get(entity.id) ?? [];
    matches.push(entity);
    idIndex.set(entity.id, matches);
  }

  for (const [id, entities] of idIndex) {
    const sources = new Set(entities.map((entity) => entity.source));

    if (sources.size > 1) {
      diagnostics.push({
        severity: "error",
        code: "DUPLICATE_ID",
        message: `Duplicate @id ${id} was found in multiple documents: ${Array.from(sources).join(", ")}.`
      });
    }
  }

  const unique = uniqueDiagnostics(diagnostics);

  return {
    ok: unique.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics: unique
  };
}

function createLoaders(customLoaders: ResolverLoader[]): ResolverLoader[] {
  return [...customLoaders, createFileSystemLoader(), createHttpLoader()];
}

async function loadWithLoaders(url: URL, loaders: ResolverLoader[]) {
  for (const loader of loaders) {
    if (!loader.canLoad(url)) {
      continue;
    }

    return {
      loader,
      source: await loader.load(url)
    };
  }

  throw new Error(`No loader is configured for protocol ${url.protocol}`);
}

function parseDocument(raw: string, source: string): UJGDocument {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${source}: ${toErrorMessage(error)}`);
  }

  if (!isJsonObject(parsed)) {
    throw new Error(`Expected ${source} to parse to a JSON object.`);
  }

  return parsed as UJGDocument;
}

function toDocumentUrl(entry: string | URL): URL {
  if (entry instanceof URL) {
    return new URL(entry.href);
  }

  try {
    return new URL(entry);
  } catch {
    return pathToFileURL(resolvePath(entry));
  }
}

async function validateDocumentShape(
  document: UJGDocument,
  source: string,
  mode: ResolverMode,
  handlerMap: Map<string, ExtensionHandler>,
  activeHandlers: Set<string>
): Promise<ResolverDiagnostic[]> {
  const diagnostics: ResolverDiagnostic[] = [];

  if (document["@type"] !== "UJGDocument") {
    diagnostics.push({
      severity: "error",
      code: "INVALID_DOCUMENT",
      message: 'Resolved document must declare "@type": "UJGDocument".',
      source,
      path: "$.@type"
    });
  }

  if (typeof document.specVersion !== "string" || document.specVersion.length === 0) {
    diagnostics.push({
      severity: "error",
      code: "INVALID_DOCUMENT",
      message: "Resolved document must include a non-empty string specVersion.",
      source,
      path: "$.specVersion"
    });
  }

  if ("extensions" in document) {
    diagnostics.push({
      severity: "error",
      code: "DOCUMENT_EXTENSIONS_NOT_ALLOWED",
      message: "extensions MUST NOT appear on UJGDocument.",
      source,
      path: "$.extensions"
    });
  }

  if ("imports" in document && !Array.isArray(document.imports)) {
    diagnostics.push({
      severity: "error",
      code: "INVALID_IMPORT",
      message: "imports must be an array of IRI-reference strings.",
      source,
      path: "$.imports"
    });
  }

  await walkNodeLikeValues(document, async (node, path) => {
    if (!("extensions" in node)) {
      return;
    }

    const extensionsValue = node.extensions;

    if (!isJsonObject(extensionsValue)) {
      diagnostics.push({
        severity: "error",
        code: "INVALID_EXTENSION_PAYLOAD",
        message: "If present, extensions MUST be a JSON object.",
        source,
        path: `${path}.extensions`
      });
      return;
    }

    for (const [namespace, value] of Object.entries(extensionsValue)) {
      if (!isJsonObject(value)) {
        diagnostics.push({
          severity: "error",
          code: "INVALID_EXTENSION_PAYLOAD",
          message: "Each top-level extensions value MUST be a JSON object.",
          source,
          path: `${path}.extensions.${namespace}`
        });
        continue;
      }

      if (!looksLikeExtensionNamespace(namespace)) {
        diagnostics.push({
          severity: "warning",
          code: "EXTENSION_NAMESPACE_FORMAT",
          message:
            "Extension namespace should use reverse-DNS or URI-style ownership to avoid collisions.",
          source,
          path: `${path}.extensions.${namespace}`
        });
      }

      const handler = handlerMap.get(namespace);

      if (!handler) {
        continue;
      }

      const context: ExtensionHandlerContext = {
        bundleMode: mode,
        namespace,
        source,
        path,
        node,
        extension: value
      };

      try {
        await handler.handle(context);
        activeHandlers.add(namespace);
      } catch (error) {
        diagnostics.push({
          severity: "error",
          code: "EXTENSION_HANDLER_FAILED",
          message: `Extension handler ${namespace} failed: ${toErrorMessage(error)}`,
          source,
          path: `${path}.extensions.${namespace}`
        });
      }
    }
  });

  return diagnostics;
}

async function walkNodeLikeValues(
  value: JsonValue | undefined,
  visitor: (node: JsonObject, path: string) => void | Promise<void>,
  path = "$",
  isRoot = true
): Promise<void> {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      await walkNodeLikeValues(item, visitor, `${path}[${index}]`, false);
    }
    return;
  }

  if (!isJsonObject(value)) {
    return;
  }

  if (!isRoot && isNodeLike(value)) {
    await visitor(value, path);
  }

  for (const [key, nested] of Object.entries(value)) {
    if (key === "extensions") {
      continue;
    }

    await walkNodeLikeValues(nested, visitor, `${path}.${key}`, false);
  }
}

function materializeBundle(entry: string, documents: ResolvedDocument[]): MaterializedBundle {
  const materializedDocuments = documents.map((document) => ({
    source: document.source,
    document: cloneDocument(document.normalizedDocument)
  }));
  const entities: MaterializedEntity[] = [];

  for (const document of materializedDocuments) {
    collectEntities(document.document, document.source, entities);
  }

  return {
    entryDocument: materializedDocuments.find((document) => document.source === entry)?.document,
    documents: materializedDocuments.map((document) => document.document),
    entities
  };
}

function collectEntities(
  value: JsonValue | undefined,
  source: string,
  entities: MaterializedEntity[],
  path = "$",
  isRoot = true
): void {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      collectEntities(item, source, entities, `${path}[${index}]`, false);
    }
    return;
  }

  if (!isJsonObject(value)) {
    return;
  }

  const id = typeof value["@id"] === "string" ? value["@id"] : undefined;

  if (isRoot && id) {
    entities.push({
      id,
      kind: "document",
      source,
      path,
      value
    });
  } else if (!isRoot && id) {
    entities.push({
      id,
      kind: "node",
      source,
      path,
      value
    });
  }

  for (const [key, nested] of Object.entries(value)) {
    if (key === "extensions") {
      continue;
    }

    collectEntities(nested, source, entities, `${path}.${key}`, false);
  }
}

function isNodeLike(value: JsonObject): boolean {
  return typeof value["@id"] === "string" || typeof value["@type"] === "string" || "extensions" in value;
}

function cloneDocument<T extends JsonValue>(value: T): T {
  return structuredClone(value);
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function looksLikeExtensionNamespace(namespace: string): boolean {
  if (namespace.length === 0) {
    return false;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(namespace)) {
    return true;
  }

  return /^[a-z0-9]+(?:[.-][a-z0-9]+)+$/i.test(namespace);
}

function uniqueDiagnostics(diagnostics: ResolverDiagnostic[]): ResolverDiagnostic[] {
  const seen = new Set<string>();

  return diagnostics.filter((diagnostic) => {
    const key = JSON.stringify(diagnostic);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getMajorVersion(version: string): string {
  return version.split(".")[0] ?? version;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
