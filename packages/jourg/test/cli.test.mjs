import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const CONTEXT_URL = "https://ujg.specs.openuji.org/ed/ns/context.jsonld";

test("jourg compile prints Graph IR JSON for valid input", async () => {
  const directory = await mkdtemp(join(tmpdir(), "jourg-cli-valid-"));

  try {
    const entryPath = join(directory, "entry.jsonld");

    await writeJson(entryPath, {
      "@context": CONTEXT_URL,
      "@id": "https://example.com/entry.jsonld",
      "@type": "UJGDocument",
      specVersion: "1.0",
      nodes: [
        {
          "@type": "Journey",
          "@id": "urn:ujg:journey:cli",
          startState: "urn:ujg:state:home",
          stateRefs: ["urn:ujg:state:home"],
          transitionRefs: ["urn:ujg:transition:home-self"]
        },
        {
          "@type": "State",
          "@id": "urn:ujg:state:home",
          label: "Home"
        },
        {
          "@type": "Transition",
          "@id": "urn:ujg:transition:home-self",
          from: "urn:ujg:state:home",
          to: "urn:ujg:state:home",
          label: "Stay"
        }
      ]
    });

    const result = spawnSync(process.execPath, ["dist/index.js", "compile", entryPath, "--json"], {
      cwd: PACKAGE_ROOT,
      encoding: "utf8"
    });

    assert.equal(result.status, 0, result.stderr);
    const graph = JSON.parse(result.stdout);
    assert.equal(graph.kind, "GraphIR");
    assert.equal(graph.journeys[0]?.id, "urn:ujg:journey:cli");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("jourg compile exits non-zero and prints diagnostics for invalid input", async () => {
  const directory = await mkdtemp(join(tmpdir(), "jourg-cli-invalid-"));

  try {
    const entryPath = join(directory, "entry.jsonld");

    await writeJson(entryPath, {
      "@type": "UJGDocument",
      specVersion: "1.0",
      nodes: []
    });

    const result = spawnSync(process.execPath, ["dist/index.js", "compile", entryPath], {
      cwd: PACKAGE_ROOT,
      encoding: "utf8"
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /INVALID_DOCUMENT/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

async function writeJson(filePath, value) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2));
}
