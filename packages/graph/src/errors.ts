import type { GraphDiagnostic } from "./types.js";

export class GraphCompileError extends Error {
  readonly diagnostics: GraphDiagnostic[];

  constructor(diagnostics: readonly GraphDiagnostic[], message = summarizeDiagnostics(diagnostics)) {
    super(message);
    this.name = "GraphCompileError";
    this.diagnostics = [...diagnostics];
  }
}

function summarizeDiagnostics(diagnostics: readonly GraphDiagnostic[]): string {
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const warnings = diagnostics.length - errors;

  return `Graph compilation failed with ${errors} error${errors === 1 ? "" : "s"} and ${warnings} warning${warnings === 1 ? "" : "s"}.`;
}
