import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUTPUT_DIR = PACKAGE_ROOT;

const TARGETS = [
  {
    id: "coreVocabulary",
    url: "https://ujg.specs.openuji.org/ed/ns/core",
    file: "artifacts/ed/ns/core.ttl"
  },
  {
    id: "coreContext",
    url: "https://ujg.specs.openuji.org/ed/ns/core.context.jsonld",
    file: "artifacts/ed/ns/core.context.jsonld"
  },
  {
    id: "coreShape",
    url: "https://ujg.specs.openuji.org/ed/ns/core.shape",
    file: "artifacts/ed/ns/core.shape.ttl"
  },
  {
    id: "graphVocabulary",
    url: "https://ujg.specs.openuji.org/ed/ns/graph",
    file: "artifacts/ed/ns/graph.ttl"
  },
  {
    id: "graphContext",
    url: "https://ujg.specs.openuji.org/ed/ns/graph.context.jsonld",
    file: "artifacts/ed/ns/graph.context.jsonld"
  },
  {
    id: "graphShape",
    url: "https://ujg.specs.openuji.org/ed/ns/graph.shape",
    file: "artifacts/ed/ns/graph.shape.ttl"
  },
  {
    id: "aggregateContext",
    url: "https://ujg.specs.openuji.org/ed/ns/context.jsonld",
    file: "artifacts/ed/ns/context.jsonld"
  }
];

const outputDir = getOutputDir(process.argv.slice(2));
const fetchedArtifacts = [];

for (const target of TARGETS) {
  const response = await fetch(target.url, {
    headers: {
      accept: "application/ld+json, text/turtle;q=0.9, application/json;q=0.8, */*;q=0.1"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${target.url}: HTTP ${response.status} ${response.statusText}`.trim());
  }

  const mediaType = normalizeMediaType(response.headers.get("content-type"));
  const raw = normalizeContent(await response.text(), target.file);
  const sha256 = createSha256(raw);
  const artifact = {
    ...target,
    mediaType,
    raw,
    sha256,
    size: Buffer.byteLength(raw, "utf8")
  };

  fetchedArtifacts.push(artifact);
  await writeOutputFile(outputDir, target.file, raw);
}

await writeOutputFile(
  outputDir,
  "artifacts/manifest.json",
  `${JSON.stringify(createManifest(fetchedArtifacts), null, 2)}\n`
);
await writeOutputFile(outputDir, "src/generated.ts", renderGeneratedModule(fetchedArtifacts));

function getOutputDir(args) {
  const outputFlagIndex = args.findIndex((value) => value === "--output-dir");

  if (outputFlagIndex === -1) {
    return DEFAULT_OUTPUT_DIR;
  }

  const next = args[outputFlagIndex + 1];

  if (!next) {
    throw new Error("Missing value for --output-dir.");
  }

  return resolve(next);
}

function normalizeMediaType(value) {
  if (!value) {
    return "application/octet-stream";
  }

  return value.split(";")[0]?.trim() || "application/octet-stream";
}

function normalizeContent(raw, file) {
  const withNormalizedNewlines = raw.replace(/\r\n/g, "\n");

  if (file.endsWith(".jsonld")) {
    return `${JSON.stringify(JSON.parse(withNormalizedNewlines), null, 2)}\n`;
  }

  return withNormalizedNewlines.endsWith("\n")
    ? withNormalizedNewlines
    : `${withNormalizedNewlines}\n`;
}

function createSha256(raw) {
  return createHash("sha256").update(raw).digest("hex");
}

function createManifest(artifacts) {
  return {
    version: 1,
    artifacts: artifacts.map(({ id, file, mediaType, sha256, size, url }) => ({
      id,
      file,
      mediaType,
      sha256,
      size,
      url
    }))
  };
}

function renderGeneratedModule(artifacts) {
  const byId = Object.fromEntries(artifacts.map((artifact) => [artifact.id, artifact]));
  const aggregateContext = JSON.parse(byId.aggregateContext.raw);
  const coreContext = JSON.parse(byId.coreContext.raw);
  const graphContext = JSON.parse(byId.graphContext.raw);
  const graphCompactTerms = Object.keys(graphContext["@context"] ?? {})
    .filter((key) => !key.startsWith("@") && key !== "ujggraph")
    .sort();
  const manifest = createManifest(artifacts);

  return `export type SpecArtifactId =
  | "aggregateContext"
  | "coreContext"
  | "coreShape"
  | "coreVocabulary"
  | "graphContext"
  | "graphShape"
  | "graphVocabulary";

export interface SpecSyncArtifact {
  id: SpecArtifactId;
  file: string;
  mediaType: string;
  sha256: string;
  size: number;
  url: string;
}

export interface SpecSyncManifest {
  version: 1;
  artifacts: SpecSyncArtifact[];
}

export const GRAPH_CONTEXT_URLS = ${JSON.stringify(
    {
      aggregate: byId.aggregateContext.url,
      core: byId.coreContext.url,
      graph: byId.graphContext.url
    },
    null,
    2
  )} as const;

export const GRAPH_COMPACT_TERMS = ${JSON.stringify(graphCompactTerms, null, 2)} as const;

export const SPEC_SYNC_MANIFEST: SpecSyncManifest = ${JSON.stringify(manifest, null, 2)};

export const SPEC_SYNC_ARTIFACTS = {
  aggregateContext: {
    url: ${JSON.stringify(byId.aggregateContext.url)},
    content: ${JSON.stringify(aggregateContext, null, 2)}
  },
  coreContext: {
    url: ${JSON.stringify(byId.coreContext.url)},
    content: ${JSON.stringify(coreContext, null, 2)}
  },
  coreShape: {
    url: ${JSON.stringify(byId.coreShape.url)},
    content: ${JSON.stringify(byId.coreShape.raw)}
  },
  coreVocabulary: {
    url: ${JSON.stringify(byId.coreVocabulary.url)},
    content: ${JSON.stringify(byId.coreVocabulary.raw)}
  },
  graphContext: {
    url: ${JSON.stringify(byId.graphContext.url)},
    content: ${JSON.stringify(graphContext, null, 2)}
  },
  graphShape: {
    url: ${JSON.stringify(byId.graphShape.url)},
    content: ${JSON.stringify(byId.graphShape.raw)}
  },
  graphVocabulary: {
    url: ${JSON.stringify(byId.graphVocabulary.url)},
    content: ${JSON.stringify(byId.graphVocabulary.raw)}
  }
} as const;
`;
}

async function writeOutputFile(outputRoot, relativePath, content) {
  const targetPath = join(outputRoot, relativePath);
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, content);
}
