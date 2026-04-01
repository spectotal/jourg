import { DEFAULT_MAX_DEPTH, toDocumentUrl } from "./common.js";
import { createFileSystemLoader, createHttpLoader, createMemoryLoader } from "./resolve.js";
import type { GraphCompileInput, GraphCompileOptions } from "../types.js";
import type { PreparedSourceInput } from "./state.js";

export function prepareSourceInput(
  input: GraphCompileInput,
  options: GraphCompileOptions
): PreparedSourceInput {
  const customLoaders = [...(options.loaders ?? [])];

  if (input.kind === "memory") {
    return {
      entryUrl: toDocumentUrl(input.entry),
      loaders: [
        createMemoryLoader(input.documents),
        ...customLoaders,
        createHttpLoader()
      ]
    };
  }

  return {
    entryUrl: toDocumentUrl(input.entry),
    loaders: [...customLoaders, createFileSystemLoader(), createHttpLoader()]
  };
}

export function getMaxDepth(options: GraphCompileOptions): number {
  return options.maxDepth ?? DEFAULT_MAX_DEPTH;
}
