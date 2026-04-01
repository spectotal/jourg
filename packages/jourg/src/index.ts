#!/usr/bin/env node

import {
  compileGraphIR,
  GraphCompileError,
  type GraphCompileOptions,
  type GraphDiagnostic,
  type GraphIR
} from "@jourg/graph";

interface CompileCliOptions extends GraphCompileOptions {
  format: "json" | "summary";
}

const [, , command, ...args] = process.argv;

async function main() {
  if (!command || command === "help") {
    printHelp();
    return;
  }

  if (command !== "compile") {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }

  const { entry, options } = parseCompileArgs(args);

  if (!entry) {
    console.error("Missing entry path or URL.");
    printHelp();
    process.exit(1);
  }

  try {
    const graph = await compileGraphIR({ kind: "locator", entry }, options);

    if (options.format === "json") {
      console.log(JSON.stringify(graph, null, 2));
    } else {
      printSummary(graph);
    }
  } catch (error) {
    if (error instanceof GraphCompileError) {
      printDiagnostics(error.diagnostics, options.format);
      process.exit(1);
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}

function parseCompileArgs(args: string[]): { entry?: string; options: CompileCliOptions } {
  const options: CompileCliOptions = {
    format: "summary",
    specVersionPolicy: "strict"
  };

  let entry: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];

    if (!value) {
      continue;
    }

    if (!value.startsWith("--")) {
      entry ??= value;
      continue;
    }

    if (value === "--allow-cycles") {
      options.allowCycles = true;
      continue;
    }

    if (value === "--json") {
      options.format = "json";
      continue;
    }

    const next = args[index + 1];

    if (
      (value === "--format" || value === "--max-depth" || value === "--spec-version-policy") &&
      !next
    ) {
      throw new Error(`Missing value for ${value}.`);
    }

    switch (value) {
      case "--format":
        if (next !== "json" && next !== "summary") {
          throw new Error(`Unsupported format: ${next}`);
        }
        options.format = next;
        index += 1;
        break;
      case "--max-depth":
        options.maxDepth = Number.parseInt(next ?? "", 10);
        if (!Number.isFinite(options.maxDepth)) {
          throw new Error(`Invalid max depth: ${next}`);
        }
        index += 1;
        break;
      case "--spec-version-policy":
        if (next !== "strict" && next !== "entry-major") {
          throw new Error(`Unsupported spec version policy: ${next}`);
        }
        options.specVersionPolicy = next;
        index += 1;
        break;
      default:
        throw new Error(`Unknown option: ${value}`);
    }
  }

  return { entry, options };
}

function printSummary(graph: GraphIR) {
  console.log(`Entry: ${graph.entry}`);
  console.log(`Spec version: ${graph.specVersion}`);
  console.log(`Documents: ${graph.documents.length}`);
  console.log(`Journeys: ${graph.journeys.length}`);
  console.log(`Entities: ${countEntities(graph)}`);
  console.log(`Warnings: ${graph.warnings.length}`);
  console.log("Compilation: ok");

  if (graph.warnings.length === 0) {
    return;
  }

  console.log("");
  console.log("Warnings:");

  for (const warning of graph.warnings) {
    console.log(formatDiagnostic(warning));
  }
}

function printDiagnostics(diagnostics: readonly GraphDiagnostic[], format: CompileCliOptions["format"]) {
  if (format === "json") {
    console.error(
      JSON.stringify(
        {
          error: "GraphCompileError",
          diagnostics
        },
        null,
        2
      )
    );
    return;
  }

  console.error("Compilation failed.");
  console.error("");

  for (const diagnostic of diagnostics) {
    console.error(formatDiagnostic(diagnostic));
  }
}

function formatDiagnostic(diagnostic: GraphDiagnostic): string {
  const source = diagnostic.source ? ` [${diagnostic.source}]` : "";
  const path = diagnostic.path ? ` (${diagnostic.path})` : "";

  return `- ${diagnostic.severity.toUpperCase()} ${diagnostic.code}${source}${path}: ${diagnostic.message}`;
}

function countEntities(graph: GraphIR): number {
  return (
    graph.entities.journeys.length +
    graph.entities.states.length +
    graph.entities.compositeStates.length +
    graph.entities.transitions.length +
    graph.entities.outgoingTransitionGroups.length +
    graph.entities.outgoingTransitions.length
  );
}

function printHelp() {
  console.log("jourg - User Journey Graph tools");
  console.log("");
  console.log("Usage:");
  console.log("  jourg help");
  console.log(
    "  jourg compile <entry> [--format summary|json] [--json] [--max-depth N] [--allow-cycles] [--spec-version-policy strict|entry-major]"
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
