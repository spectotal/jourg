import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  GRAPH_CONTEXT_URLS,
  SPEC_SYNC_ARTIFACTS,
  SPEC_SYNC_MANIFEST
} from "../dist/index.js";

const PACKAGE_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const EXPECTED_FILES = [
  "artifacts/ed/ns/core",
  "artifacts/ed/ns/core.context.jsonld",
  "artifacts/ed/ns/core.shape",
  "artifacts/ed/ns/graph",
  "artifacts/ed/ns/graph.context.jsonld",
  "artifacts/ed/ns/graph.shape",
  "artifacts/ed/ns/context.jsonld"
];

test("spec-sync exports the expected UJG artifact set", async () => {
  assert.equal(SPEC_SYNC_MANIFEST.version, 1);
  assert.equal(SPEC_SYNC_MANIFEST.artifacts.length, EXPECTED_FILES.length);
  assert.deepEqual(
    SPEC_SYNC_MANIFEST.artifacts.map((artifact) => artifact.file),
    EXPECTED_FILES
  );
  assert.equal(
    GRAPH_CONTEXT_URLS.core,
    "https://ujg.specs.openuji.org/ed/ns/core.context.jsonld"
  );
  assert.equal(
    GRAPH_CONTEXT_URLS.graph,
    "https://ujg.specs.openuji.org/ed/ns/graph.context.jsonld"
  );
  assert.ok(Array.isArray(SPEC_SYNC_ARTIFACTS.aggregateContext.content["@context"]));

  for (const relativePath of EXPECTED_FILES) {
    const raw = await readFile(join(PACKAGE_ROOT, relativePath), "utf8");
    assert.ok(raw.length > 0, `${relativePath} should not be empty`);
  }
});

test("sync script is deterministic against the current upstream artifacts", async () => {
  const directory = await mkdtemp(join(tmpdir(), "jourg-spec-sync-"));

  try {
    const command = `node ./packages/spec-sync/scripts/sync.mjs --output-dir ${JSON.stringify(directory)}`;
    execFileSync("/bin/zsh", ["-lc", command], {
      cwd: resolve(PACKAGE_ROOT, "../.."),
      stdio: "pipe"
    });

    for (const relativePath of [...EXPECTED_FILES, "artifacts/manifest.json", "src/generated.ts"]) {
      const expected = await readFile(join(PACKAGE_ROOT, relativePath), "utf8");
      const actual = await readFile(join(directory, relativePath), "utf8");
      assert.equal(actual, expected, `${relativePath} should be generated deterministically`);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
