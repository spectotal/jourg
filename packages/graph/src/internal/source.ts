import { toDocumentUrl } from "./common.js";
import { createFileSystemLoader, createHttpLoader } from "./resolve.js";
import type { GraphCompileInput, GraphCompileOptions } from "../types.js";
import type { PreparedSourceInput } from "./state.js";

export function prepareSourceInput(
  input: GraphCompileInput,
  options: GraphCompileOptions
): PreparedSourceInput {
  const customLoaders = [...(options.loaders ?? [])];

  return {
    entryUrl: toDocumentUrl(input.entry),
    loaders: [...customLoaders, createFileSystemLoader(), createHttpLoader()]
  };
}
