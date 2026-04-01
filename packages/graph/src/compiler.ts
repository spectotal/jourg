import { GraphCompileError } from "./errors.js";
import { extractGraph } from "./internal/extract-graph.js";
import { injectJourneys } from "./internal/inject.js";
import { emitGraphIR } from "./internal/ir.js";
import { resolveSources } from "./internal/resolve.js";
import { prepareSourceInput } from "./internal/source.js";
import { uniqueDiagnostics } from "./internal/common.js";
import { validateCore } from "./internal/validate-core.js";
import { validateGraph } from "./internal/validate-graph.js";
import type { GraphCompileInput, GraphCompileOptions, GraphIR } from "./types.js";

export async function compileGraphIR(
  input: GraphCompileInput,
  options: GraphCompileOptions = {}
): Promise<GraphIR> {
  const prepared = prepareSourceInput(input, options);
  const resolved = await resolveSources(prepared, options);
  const coreValidated = validateCore(resolved.value, options);
  const extracted = extractGraph(resolved.value);
  const graphValidated = validateGraph(extracted.value);
  const diagnostics = uniqueDiagnostics([
    ...resolved.diagnostics,
    ...coreValidated.diagnostics,
    ...extracted.diagnostics,
    ...graphValidated.diagnostics
  ]);

  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    throw new GraphCompileError(diagnostics);
  }

  const injected = injectJourneys(graphValidated.value);
  return emitGraphIR(
    resolved.value,
    coreValidated.value,
    extracted.value.entities,
    injected,
    diagnostics
  );
}
