import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { normalizeImports, resolveDocument, validateBundle } from "../dist/index.js";

async function writeJson(filePath, value) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2));
}

test("normalizeImports resolves relative imports against the importing document", () => {
  const normalized = normalizeImports(
    {
      "@type": "UJGDocument",
      specVersion: "1.0",
      imports: ["./b.jsonld", "https://example.com/shared.jsonld", "./a.jsonld", "./b.jsonld"]
    },
    new URL("https://example.com/flows/entry.jsonld")
  );

  assert.deepEqual(normalized.imports, [
    "https://example.com/flows/a.jsonld",
    "https://example.com/flows/b.jsonld",
    "https://example.com/shared.jsonld"
  ]);
});

test("resolveDocument loads file imports transitively and preserves extension payloads", async () => {
  const directory = await mkdtemp(join(tmpdir(), "jourg-resolver-file-"));
  const seenNamespaces = [];

  try {
    await writeJson(join(directory, "entry.jsonld"), {
      "@context": "https://ujg.specs.openuji.org/ed/ns/core.context.jsonld",
      "@id": "https://example.com/entry.jsonld",
      "@type": "UJGDocument",
      specVersion: "1.0",
      imports: ["./shared/states.jsonld", "./runtime/events.jsonld"],
      nodes: [
        {
          "@id": "urn:ujg:node:entry",
          "@type": "Node"
        }
      ]
    });

    await writeJson(join(directory, "shared/states.jsonld"), {
      "@context": "https://ujg.specs.openuji.org/ed/ns/core.context.jsonld",
      "@id": "https://example.com/shared/states.jsonld",
      "@type": "UJGDocument",
      specVersion: "1.0",
      imports: ["../common/leaf.jsonld"],
      nodes: [
        {
          "@id": "urn:ujg:node:shared",
          "@type": "Node",
          extensions: {
            "com.example.audit": {
              checksum: "sha256:abc123"
            }
          }
        }
      ]
    });

    await writeJson(join(directory, "common/leaf.jsonld"), {
      "@context": "https://ujg.specs.openuji.org/ed/ns/core.context.jsonld",
      "@id": "https://example.com/common/leaf.jsonld",
      "@type": "UJGDocument",
      specVersion: "1.0",
      nodes: [
        {
          "@id": "urn:ujg:node:leaf",
          "@type": "Node"
        }
      ]
    });

    await writeJson(join(directory, "runtime/events.jsonld"), {
      "@context": "https://ujg.specs.openuji.org/ed/ns/core.context.jsonld",
      "@id": "https://example.com/runtime/events.jsonld",
      "@type": "UJGDocument",
      specVersion: "1.0",
      items: [
        {
          "@id": "urn:ujg:event:100",
          "@type": "RuntimeEvent"
        }
      ]
    });

    const bundle = await resolveDocument(pathToFileURL(join(directory, "entry.jsonld")), {
      extensionHandlers: [
        {
          namespace: "com.example.audit",
          support: "validate",
          handle(context) {
            seenNamespaces.push(context.namespace);
            assert.equal(context.extension.checksum, "sha256:abc123");
          }
        }
      ]
    });

    assert.equal(bundle.validation.ok, true);
    assert.equal(bundle.documents.length, 4);
    assert.deepEqual(bundle.activeExtensionHandlers, ["com.example.audit"]);
    assert.equal(bundle.imports.filter((edge) => edge.status === "resolved").length, 3);
    assert.ok(
      bundle.materialized.entities.some((entity) => entity.id === "urn:ujg:node:shared")
    );
    assert.deepEqual(seenNamespaces, ["com.example.audit"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("resolveDocument loads HTTP imports against the importing document URL", async () => {
  const documents = new Map([
    [
      "/flows/entry.jsonld",
      {
        "@context": "https://ujg.specs.openuji.org/ed/ns/core.context.jsonld",
        "@id": "https://example.com/flows/entry.jsonld",
        "@type": "UJGDocument",
        specVersion: "1.0",
        imports: ["./shared.jsonld"]
      }
    ],
    [
      "/flows/shared.jsonld",
      {
        "@context": "https://ujg.specs.openuji.org/ed/ns/core.context.jsonld",
        "@id": "https://example.com/flows/shared.jsonld",
        "@type": "UJGDocument",
        specVersion: "1.0",
        nodes: [
          {
            "@id": "urn:ujg:node:http-shared",
            "@type": "Node"
          }
        ]
      }
    ]
  ]);

  const server = createServer((request, response) => {
    const body = documents.get(request.url);

    if (!body) {
      response.statusCode = 404;
      response.end("not found");
      return;
    }

    response.setHeader("content-type", "application/ld+json");
    response.end(JSON.stringify(body));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    const entryUrl = new URL(`http://127.0.0.1:${address.port}/flows/entry.jsonld`);
    const bundle = await resolveDocument(entryUrl);

    assert.equal(bundle.validation.ok, true);
    assert.equal(bundle.documents.length, 2);
    assert.equal(bundle.imports[0]?.resolved, `http://127.0.0.1:${address.port}/flows/shared.jsonld`);
    assert.equal(bundle.imports[0]?.via, "http");
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve(undefined)));
    });
  }
});

test("validateBundle reports document-level extension errors, cycles, version mismatch, and duplicate ids", async () => {
  const directory = await mkdtemp(join(tmpdir(), "jourg-resolver-invalid-"));

  try {
    await writeJson(join(directory, "entry.jsonld"), {
      "@context": "https://ujg.specs.openuji.org/ed/ns/core.context.jsonld",
      "@id": "https://example.com/invalid/entry.jsonld",
      "@type": "UJGDocument",
      specVersion: "1.0",
      imports: ["./shared.jsonld", "./bad.jsonld"],
      extensions: {
        "com.example.invalid": {}
      }
    });

    await writeJson(join(directory, "shared.jsonld"), {
      "@context": "https://ujg.specs.openuji.org/ed/ns/core.context.jsonld",
      "@id": "https://example.com/invalid/shared.jsonld",
      "@type": "UJGDocument",
      specVersion: "2.0",
      imports: ["./entry.jsonld"],
      nodes: [
        {
          "@id": "urn:ujg:node:dup",
          "@type": "Node"
        }
      ]
    });

    await writeJson(join(directory, "bad.jsonld"), {
      "@context": "https://ujg.specs.openuji.org/ed/ns/core.context.jsonld",
      "@id": "https://example.com/invalid/bad.jsonld",
      "@type": "UJGDocument",
      specVersion: "1.0",
      nodes: [
        {
          "@id": "urn:ujg:node:dup",
          "@type": "Node",
          extensions: {
            "invalid namespace": "oops"
          }
        }
      ]
    });

    const bundle = await resolveDocument(pathToFileURL(join(directory, "entry.jsonld")));
    const validation = validateBundle(bundle);
    const codes = new Set(validation.diagnostics.map((diagnostic) => diagnostic.code));

    assert.equal(validation.ok, false);
    assert.ok(codes.has("DOCUMENT_EXTENSIONS_NOT_ALLOWED"));
    assert.ok(codes.has("CYCLE_DETECTED"));
    assert.ok(codes.has("SPEC_VERSION_MISMATCH"));
    assert.ok(codes.has("DUPLICATE_ID"));
    assert.ok(codes.has("INVALID_EXTENSION_PAYLOAD"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
