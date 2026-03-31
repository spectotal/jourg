#!/usr/bin/env node

import { resolveDocument, type ResolveOptions } from "@jourg/resolver";

interface ResolveCliOptions extends ResolveOptions {
  format: "json" | "summary";
}

const [, , command, ...args] = process.argv;

async function main() {
  if (!command || command === "help") {
    printHelp();
    return;
  }

  if (command !== "resolve") {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }

  const { entry, options } = parseResolveArgs(args);

  if (!entry) {
    console.error("Missing entry path or URL.");
    printHelp();
    process.exit(1);
  }

  const bundle = await resolveDocument(entry, options);

  if (options.format === "json") {
    console.log(JSON.stringify(bundle, null, 2));
  } else {
    printSummary(bundle);
  }

  if (!bundle.validation.ok) {
    process.exit(1);
  }
}

function parseResolveArgs(args: string[]): { entry?: string; options: ResolveCliOptions } {
  const options: ResolveCliOptions = {
    format: "summary",
    mode: "consumer"
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

    if ((value === "--mode" || value === "--format" || value === "--max-depth") && !next) {
      throw new Error(`Missing value for ${value}.`);
    }

    switch (value) {
      case "--mode":
        if (next !== "consumer" && next !== "producer") {
          throw new Error(`Unsupported mode: ${next}`);
        }
        options.mode = next;
        index += 1;
        break;
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
      default:
        throw new Error(`Unknown option: ${value}`);
    }
  }

  return { entry, options };
}

function printSummary(bundle: Awaited<ReturnType<typeof resolveDocument>>) {
  const warningCount = bundle.validation.diagnostics.filter(
    (diagnostic) => diagnostic.severity === "warning"
  ).length;
  const errorCount = bundle.validation.diagnostics.length - warningCount;

  console.log(`Entry: ${bundle.entry}`);
  console.log(`Mode: ${bundle.mode}`);
  console.log(`Documents: ${bundle.documents.length}`);
  console.log(`Imports: ${bundle.imports.length}`);
  console.log(`Materialized entities: ${bundle.materialized.entities.length}`);
  console.log(`Diagnostics: ${errorCount} errors, ${warningCount} warnings`);
  console.log(
    `Extension handlers: ${
      bundle.activeExtensionHandlers.length > 0
        ? bundle.activeExtensionHandlers.join(", ")
        : "none"
    }`
  );
  console.log(`Validation: ${bundle.validation.ok ? "ok" : "failed"}`);

  if (bundle.validation.diagnostics.length === 0) {
    return;
  }

  console.log("");
  console.log("Diagnostics:");

  for (const diagnostic of bundle.validation.diagnostics) {
    const location = diagnostic.path ? ` (${diagnostic.path})` : "";
    const source = diagnostic.source ? ` [${diagnostic.source}]` : "";
    console.log(
      `- ${diagnostic.severity.toUpperCase()} ${diagnostic.code}${source}${location}: ${diagnostic.message}`
    );
  }
}

function printHelp() {
  console.log("jourg - User Journey Graph tools");
  console.log("");
  console.log("Usage:");
  console.log("  jourg help");
  console.log("  jourg resolve <entry> [--mode consumer|producer] [--format summary|json] [--json] [--max-depth N] [--allow-cycles]");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
