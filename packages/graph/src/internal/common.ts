import type { GraphDiagnostic, GraphNodeType, JsonObject, JsonValue } from "../types.js";

export const DEFAULT_MAX_DEPTH = 32;

export const GRAPH_NODE_TYPES = new Set<GraphNodeType>([
  "Journey",
  "State",
  "CompositeState",
  "Transition",
  "OutgoingTransitionGroup",
  "OutgoingTransition"
]);

export function toDocumentUrl(entry: string | URL): URL {
  if (entry instanceof URL) {
    return new URL(entry.href);
  }

  try {
    return new URL(entry);
  } catch {
    const normalizedEntry = entry.replace(/\\/g, "/");
    const cwd =
      typeof process !== "undefined" && typeof process.cwd === "function"
        ? process.cwd().replace(/\\/g, "/")
        : "/";
    const basePath = cwd.endsWith("/") ? cwd : `${cwd}/`;
    const fileBase = `file://${basePath.startsWith("/") ? "" : "/"}${basePath}`;
    return new URL(normalizedEntry, fileBase);
  }
}

export function cloneJson<T extends JsonValue>(value: T): T {
  return structuredClone(value);
}

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function uniqueDiagnostics(diagnostics: readonly GraphDiagnostic[]): GraphDiagnostic[] {
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

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function looksLikeExtensionNamespace(namespace: string): boolean {
  if (namespace.length === 0) {
    return false;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(namespace)) {
    return true;
  }

  return /^[a-z0-9]+(?:[.-][a-z0-9]+)+$/i.test(namespace);
}

export function getRequiredString(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function getOptionalString(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function getRequiredStringArray(
  value: JsonValue | undefined,
  minimumLength: number
): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  if (value.length < minimumLength || value.some((item) => typeof item !== "string")) {
    return undefined;
  }

  return [...value] as string[];
}

export function getOptionalStringArray(value: JsonValue | undefined): string[] | undefined {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return undefined;
  }

  return [...value] as string[];
}
