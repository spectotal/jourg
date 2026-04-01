import { cloneJson, isJsonObject, toDocumentUrl, toErrorMessage } from "./common.js";
import { getMaxDepth } from "./source.js";
import type {
  GraphCompileOptions,
  GraphDiagnostic,
  GraphIRDocumentImport,
  GraphIRLoader,
  LoadedGraphSource,
  UJGDocument
} from "../types.js";
import type { PreparedSourceInput, ResolvedBundle, ResolvedDocument } from "./state.js";

export function createFileSystemLoader(): GraphIRLoader {
  return {
    name: "file",
    canLoad(url) {
      return url.protocol === "file:";
    },
    async load(url) {
      const [fsModule, urlModule] = await Promise.all([
        importNodeModule<typeof import("node:fs/promises")>("node:fs/promises"),
        importNodeModule<typeof import("node:url")>("node:url")
      ]);
      const { readFile } = fsModule;
      const { fileURLToPath } = urlModule;
      const raw = await readFile(fileURLToPath(url), "utf8");
      return {
        document: parseDocument(raw, url.href),
        mediaType: "application/ld+json"
      };
    }
  };
}

export function createHttpLoader(fetchImpl: typeof fetch = fetch): GraphIRLoader {
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
  if (!Array.isArray(document.imports)) {
    return document;
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

  const normalizedImports = Array.from(new Set(imports)).sort();
  const importsAreStable =
    document.imports.length === normalizedImports.length &&
    document.imports.every((value, index) => value === normalizedImports[index]);

  return importsAreStable
    ? document
    : {
        ...document,
        imports: normalizedImports
      };
}

export async function resolveBundle(
  prepared: PreparedSourceInput,
  options: GraphCompileOptions
): Promise<ResolvedBundle> {
  const documents = new Map<string, ResolvedDocument>();
  const inFlight = new Map<string, Promise<boolean>>();
  const diagnostics: GraphDiagnostic[] = [];
  const maxDepth = getMaxDepth(options);
  const allowCycles = options.allowCycles ?? false;

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

    const existing = inFlight.get(source);

    if (existing) {
      return existing;
    }

    const visitPromise = visitResolvedDocument(url, depth, ancestry);
    inFlight.set(source, visitPromise);

    try {
      return await visitPromise;
    } finally {
      inFlight.delete(source);
    }
  };

  const visitResolvedDocument = async (
    url: URL,
    depth: number,
    ancestry: string[]
  ): Promise<boolean> => {
    const source = url.href;

    let loadedSource: LoadedGraphSource;
    let loaderName: string;

    try {
      const loaded = await loadWithLoaders(url, prepared.loaders);
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

    const document = cloneJson(loadedSource.document as UJGDocument);
    const normalizedDocument = normalizeImports(document, url);
    const resolvedDocument: ResolvedDocument = {
      source,
      loader: loaderName,
      normalizedDocument,
      imports: []
    };

    documents.set(source, resolvedDocument);

    if (!Array.isArray(document.imports)) {
      return true;
    }

    await Promise.all(
      document.imports.map(async (request) => {
        const edge: GraphIRDocumentImport = {
          from: source,
          request: typeof request === "string" ? request : String(request),
          resolved: null,
          status: "invalid"
        };

        resolvedDocument.imports.push(edge);

        if (typeof request !== "string") {
          diagnostics.push({
            severity: "error",
            code: "INVALID_IMPORT",
            message: "imports values must be strings representing IRI references.",
            source,
            importRef: edge.request
          });
          return;
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
          return;
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
            return;
          }
        }

        const loaded = await visit(targetUrl, depth + 1, [...ancestry, source]);
        edge.status = loaded ? "resolved" : edge.status === "cycle" ? "cycle" : "unresolved";

        if (loaded) {
          edge.via = documents.get(targetUrl.href)?.loader;
        }
      })
    );

    return true;
  };

  await visit(prepared.entryUrl, 0, []);

  return {
    entry: prepared.entryUrl.href,
    documents: Array.from(documents.values()).sort((left, right) => left.source.localeCompare(right.source)),
    diagnostics
  };
}

async function loadWithLoaders(url: URL, loaders: readonly GraphIRLoader[]) {
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

const importNodeModule = new Function(
  "specifier",
  "return import(specifier);"
) as <T>(specifier: string) => Promise<T>;
