import { GraphCompileError } from "./errors.js";
import { extractGraphBundle } from "./internal/extract-graph.js";
import { injectJourneys } from "./internal/inject.js";
import { emitGraphIR } from "./internal/ir.js";
import { resolveBundle } from "./internal/resolve.js";
import { prepareSourceInput } from "./internal/source.js";
import { uniqueDiagnostics } from "./internal/common.js";
import { validateCoreBundle } from "./internal/validate-core.js";
import { validateGraphBundle } from "./internal/validate-graph.js";
import type { GraphCompileInput, GraphCompileOptions, GraphIR } from "./types.js";

export async function compileGraphIR(
  input: GraphCompileInput,
  options: GraphCompileOptions = {}
): Promise<GraphIR> {
  const prepared = prepareSourceInput(input, options);
  const resolved = await resolveBundle(prepared, options);
  const coreValidated = validateCoreBundle(resolved, options);
  const extracted = extractGraphBundle(coreValidated);
  const graphValidated = validateGraphBundle(extracted);
  const diagnostics = uniqueDiagnostics(graphValidated.diagnostics);

  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    throw new GraphCompileError(diagnostics);
  }

  const injected = injectJourneys(graphValidated);
  return emitGraphIR(injected, diagnostics);
}
