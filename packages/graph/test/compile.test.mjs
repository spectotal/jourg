import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { compileGraphIR, GraphCompileError } from "../dist/index.js";

const CONTEXT_URL = "https://ujg.specs.openuji.org/ed/ns/context.jsonld";

test("compileGraphIR compiles memory input with imports and injected mixed edges", async () => {
  const entrySource = "https://memory.example/flows/main.jsonld";
  const checkoutSource = "https://memory.example/flows/checkout.jsonld";

  const graph = await compileGraphIR(
    {
      kind: "memory",
      entry: entrySource,
      documents: [
        {
          source: entrySource,
          document: {
            "@context": CONTEXT_URL,
            "@id": entrySource,
            "@type": "UJGDocument",
            specVersion: "1.0",
            imports: ["./checkout.jsonld"],
            nodes: [
              {
                "@type": "Journey",
                "@id": "urn:ujg:journey:main-site",
                startState: "urn:ujg:state:home",
                stateRefs: ["urn:ujg:state:home", "urn:ujg:state:checkout-flow"],
                transitionRefs: [
                  "urn:ujg:transition:home-to-checkout",
                  "urn:ujg:transition:checkout-to-profile"
                ],
                outgoingTransitionGroupRefs: ["urn:ujg:otg:global-header"]
              },
              {
                "@type": "Transition",
                "@id": "urn:ujg:transition:home-to-checkout",
                from: "urn:ujg:state:home",
                to: "urn:ujg:state:checkout-flow",
                label: "Buy now"
              },
              {
                "@type": "Transition",
                "@id": "urn:ujg:transition:checkout-to-profile",
                from: "urn:ujg:state:checkout-flow",
                to: "urn:ujg:state:profile",
                label: "Profile"
              },
              {
                "@type": "State",
                "@id": "urn:ujg:state:home",
                label: "Home page",
                tags: ["landing", "marketing"]
              },
              {
                "@type": "CompositeState",
                "@id": "urn:ujg:state:checkout-flow",
                label: "Checkout process",
                subjourneyId: "urn:ujg:journey:checkout"
              },
              {
                "@type": "State",
                "@id": "urn:ujg:state:profile",
                label: "Profile"
              },
              {
                "@type": "OutgoingTransition",
                "@id": "urn:ujg:ot:go-home",
                to: "urn:ujg:state:home",
                label: "Home"
              },
              {
                "@type": "OutgoingTransition",
                "@id": "urn:ujg:ot:go-profile",
                to: "urn:ujg:state:profile",
                label: "Profile"
              },
              {
                "@type": "OutgoingTransitionGroup",
                "@id": "urn:ujg:otg:global-header",
                outgoingTransitionRefs: ["urn:ujg:ot:go-home", "urn:ujg:ot:go-profile"]
              }
            ]
          }
        },
        {
          source: checkoutSource,
          document: {
            "@context": CONTEXT_URL,
            "@id": checkoutSource,
            "@type": "UJGDocument",
            specVersion: "1.0",
            nodes: [
              {
                "@type": "Journey",
                "@id": "urn:ujg:journey:checkout",
                startState: "urn:ujg:state:shipping",
                stateRefs: ["urn:ujg:state:shipping", "urn:ujg:state:payment"],
                transitionRefs: ["urn:ujg:transition:shipping-to-payment"]
              },
              {
                "@type": "State",
                "@id": "urn:ujg:state:shipping",
                label: "Shipping"
              },
              {
                "@type": "State",
                "@id": "urn:ujg:state:payment",
                label: "Payment"
              },
              {
                "@type": "Transition",
                "@id": "urn:ujg:transition:shipping-to-payment",
                from: "urn:ujg:state:shipping",
                to: "urn:ujg:state:payment",
                label: "Continue"
              }
            ]
          }
        }
      ]
    }
  );

  assert.equal(graph.kind, "GraphIR");
  assert.equal(graph.documents.length, 2);
  assert.equal(
    graph.documents.find((document) => document.source === entrySource)?.imports[0]?.resolved,
    checkoutSource
  );
  assert.equal(graph.journeys.length, 2);

  const mainJourney = graph.journeys.find((journey) => journey.id === "urn:ujg:journey:main-site");

  assert.ok(mainJourney);
  assert.deepEqual(mainJourney.memberStateIds, [
    "urn:ujg:state:home",
    "urn:ujg:state:checkout-flow"
  ]);
  assert.equal(mainJourney.edges.length, 5);
  assert.equal(
    mainJourney.edges.find((edge) => edge.id === "urn:ujg:state:checkout-flow::urn:ujg:state:profile")?.kind,
    "mixed"
  );
});

test("compileGraphIR loads locator input from file URLs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "jourg-graph-file-"));

  try {
    const entryPath = join(directory, "flows/entry.jsonld");

    await writeJson(entryPath, {
      "@context": CONTEXT_URL,
      "@id": "https://example.com/flows/entry.jsonld",
      "@type": "UJGDocument",
      specVersion: "1.0",
            nodes: [
              {
                "@type": "Journey",
                "@id": "urn:ujg:journey:file",
                startState: "urn:ujg:state:file-home",
                stateRefs: ["urn:ujg:state:file-home"],
                transitionRefs: ["urn:ujg:transition:file-home-self"]
              },
              {
                "@type": "State",
                "@id": "urn:ujg:state:file-home",
                label: "File home"
              },
              {
                "@type": "Transition",
                "@id": "urn:ujg:transition:file-home-self",
                from: "urn:ujg:state:file-home",
                to: "urn:ujg:state:file-home",
                label: "Stay"
              }
            ]
          });

    const graph = await compileGraphIR({
      kind: "locator",
      entry: pathToFileURL(entryPath)
    });

    assert.equal(graph.entry, pathToFileURL(entryPath).href);
    assert.equal(graph.documents.length, 1);
    assert.equal(graph.journeys[0]?.id, "urn:ujg:journey:file");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("compileGraphIR loads locator input from HTTP URLs", async () => {
  const documents = new Map([
    [
      "/flows/entry.jsonld",
      {
        "@context": CONTEXT_URL,
        "@id": "https://example.com/flows/entry.jsonld",
        "@type": "UJGDocument",
        specVersion: "1.0",
        imports: ["./shared.jsonld"],
        nodes: [
          {
            "@type": "Journey",
            "@id": "urn:ujg:journey:http",
            startState: "urn:ujg:state:http-home",
            stateRefs: ["urn:ujg:state:http-home"],
            transitionRefs: ["urn:ujg:transition:http-home-self"]
          },
          {
            "@type": "State",
            "@id": "urn:ujg:state:http-home",
            label: "HTTP home"
          },
          {
            "@type": "Transition",
            "@id": "urn:ujg:transition:http-home-self",
            from: "urn:ujg:state:http-home",
            to: "urn:ujg:state:http-home",
            label: "Stay"
          }
        ]
      }
    ],
    [
      "/flows/shared.jsonld",
      {
        "@context": CONTEXT_URL,
        "@id": "https://example.com/flows/shared.jsonld",
        "@type": "UJGDocument",
        specVersion: "1.0",
        nodes: [
          {
            "@type": "State",
            "@id": "urn:ujg:state:http-shared",
            label: "HTTP shared"
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
    const graph = await compileGraphIR({
      kind: "locator",
      entry: entryUrl
    });

    assert.equal(graph.documents.length, 2);
    assert.equal(graph.documents[0]?.imports[0]?.via, "http");
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve(undefined)));
    });
  }
});

test("compileGraphIR rejects invalid Core and Graph inputs", async () => {
  await assert.rejects(
    compileGraphIR({
      kind: "memory",
      entry: "https://memory.example/invalid.jsonld",
      documents: [
        {
          source: "https://memory.example/invalid.jsonld",
          document: {
            "@type": "UJGDocument",
            specVersion: "1.0",
            imports: [42],
            extensions: {},
            nodes: [
              {
                "@type": "Journey",
                "@id": "urn:ujg:journey:broken",
                startState: "urn:ujg:state:missing",
                stateRefs: ["urn:ujg:state:home"],
                transitionRefs: ["urn:ujg:state:home"]
              },
              {
                "@type": "State",
                "@id": "urn:ujg:state:home",
                label: "Home"
              }
            ]
          }
        }
      ]
    }),
    (error) => {
      assert.ok(error instanceof GraphCompileError);
      const codes = new Set(error.diagnostics.map((diagnostic) => diagnostic.code));
      assert.ok(codes.has("INVALID_DOCUMENT"));
      assert.ok(codes.has("INVALID_IMPORT"));
      assert.ok(codes.has("DOCUMENT_EXTENSIONS_NOT_ALLOWED"));
      assert.ok(codes.has("GRAPH_REFERENCE_MISSING"));
      assert.ok(codes.has("GRAPH_REFERENCE_TYPE"));
      return true;
    }
  );
});

test("compileGraphIR rejects duplicate ids and invalid subjourney targets", async () => {
  await assert.rejects(
    compileGraphIR({
      kind: "memory",
      entry: "https://memory.example/a.jsonld",
      documents: [
        {
          source: "https://memory.example/a.jsonld",
          document: {
            "@context": CONTEXT_URL,
            "@id": "https://memory.example/a.jsonld",
            "@type": "UJGDocument",
            specVersion: "1.0",
            imports: ["./b.jsonld"],
            nodes: [
              {
                "@type": "Journey",
                "@id": "urn:ujg:journey:a",
                startState: "urn:ujg:state:dup",
                stateRefs: ["urn:ujg:state:dup", "urn:ujg:state:sub"],
                transitionRefs: []
              },
              {
                "@type": "State",
                "@id": "urn:ujg:state:dup",
                label: "Duplicate"
              },
              {
                "@type": "CompositeState",
                "@id": "urn:ujg:state:sub",
                label: "Sub",
                subjourneyId: "urn:ujg:state:dup"
              }
            ]
          }
        },
        {
          source: "https://memory.example/b.jsonld",
          document: {
            "@context": CONTEXT_URL,
            "@id": "https://memory.example/b.jsonld",
            "@type": "UJGDocument",
            specVersion: "1.0",
            nodes: [
              {
                "@type": "State",
                "@id": "urn:ujg:state:dup",
                label: "Duplicate again"
              }
            ]
          }
        }
      ]
    }),
    (error) => {
      assert.ok(error instanceof GraphCompileError);
      const codes = new Set(error.diagnostics.map((diagnostic) => diagnostic.code));
      assert.ok(codes.has("DUPLICATE_ID"));
      assert.ok(codes.has("GRAPH_REFERENCE_TYPE"));
      return true;
    }
  );
});

test("compileGraphIR rejects cycles when allowCycles is false", async () => {
  await assert.rejects(
    compileGraphIR({
      kind: "memory",
      entry: "https://memory.example/a.jsonld",
      documents: [
        {
          source: "https://memory.example/a.jsonld",
          document: {
            "@context": CONTEXT_URL,
            "@id": "https://memory.example/a.jsonld",
            "@type": "UJGDocument",
            specVersion: "1.0",
            imports: ["./b.jsonld"],
            nodes: []
          }
        },
        {
          source: "https://memory.example/b.jsonld",
          document: {
            "@context": CONTEXT_URL,
            "@id": "https://memory.example/b.jsonld",
            "@type": "UJGDocument",
            specVersion: "1.0",
            imports: ["./a.jsonld"],
            nodes: []
          }
        }
      ]
    }),
    (error) => {
      assert.ok(error instanceof GraphCompileError);
      assert.ok(error.diagnostics.some((diagnostic) => diagnostic.code === "CYCLE_DETECTED"));
      return true;
    }
  );
});

test("compileGraphIR returns warnings without failing when extension namespaces are malformed", async () => {
  const graph = await compileGraphIR({
    kind: "memory",
    entry: "https://memory.example/warning.jsonld",
    documents: [
      {
        source: "https://memory.example/warning.jsonld",
        document: {
          "@context": CONTEXT_URL,
          "@id": "https://memory.example/warning.jsonld",
          "@type": "UJGDocument",
          specVersion: "1.0",
          nodes: [
            {
              "@type": "Journey",
              "@id": "urn:ujg:journey:warning",
              startState: "urn:ujg:state:home",
              stateRefs: ["urn:ujg:state:home"],
              transitionRefs: ["urn:ujg:transition:home-self"],
              extensions: {
                "invalid namespace": {}
              }
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
        }
      }
    ]
  });

  assert.equal(graph.journeys.length, 1);
  assert.ok(graph.warnings.some((diagnostic) => diagnostic.code === "EXTENSION_NAMESPACE_FORMAT"));
});

async function writeJson(filePath, value) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2));
}
