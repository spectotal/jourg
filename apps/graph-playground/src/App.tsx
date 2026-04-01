import {
  compileGraphIR,
  GraphCompileError,
  type GraphDiagnostic,
  type GraphIR,
  type GraphIRJourney,
  type GraphIRMemoryDocument,
  type JsonObject,
} from "@jourg/graph";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow
} from "@xyflow/react";
import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";

import {
  createFlowGraph,
  type JourneyFlowEdge,
  type JourneyFlowNode
} from "./flow";
import { JourneyCanvasNode } from "./JourneyCanvasNode";

const SAMPLE_INPUT = JSON.stringify(
  [
    {
      "@context": "https://ujg.specs.openuji.org/ed/ns/context.jsonld",
      "@id": "https://example.com/ujg/graph/main-site.jsonld",
      "@type": "UJGDocument",
      specVersion: "1.0",
      nodes: [
        {
          "@type": "Journey",
          "@id": "urn:ujg:journey:main-site",
          startState: "urn:ujg:state:home",
          stateRefs: ["urn:ujg:state:home", "urn:ujg:state:checkout-flow"],
          transitionRefs: [
            "urn:ujg:transition:home-to-checkout",
            "urn:ujg:transition:checkout-to-home"
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
          "@id": "urn:ujg:transition:checkout-to-home",
          from: "urn:ujg:state:checkout-flow",
          to: "urn:ujg:state:home",
          label: "Home"
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
    },
    {
      "@context": "https://ujg.specs.openuji.org/ed/ns/context.jsonld",
      "@id": "https://example.com/ujg/graph/checkout.jsonld",
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
  ],
  null,
  2
);

const EMPTY_FLOW = {
  nodes: [],
  edges: []
} satisfies {
  nodes: JourneyFlowNode[];
  edges: JourneyFlowEdge[];
};

interface Analysis {
  documents: GraphIRMemoryDocument[];
  diagnostics: GraphDiagnostic[];
  graph: GraphIR | null;
  parseError?: string;
}

type JourneyLayoutMemory = Record<string, { x: number; y: number }>;
type LayoutMemory = Record<string, JourneyLayoutMemory>;

const nodeTypes = {
  journeyNode: JourneyCanvasNode
};

function FlowWorkbench() {
  const [sourceText, setSourceText] = useState(SAMPLE_INPUT);
  const [analysis, setAnalysis] = useState<Analysis>({
    documents: [],
    diagnostics: [],
    graph: null
  });
  const [selectedJourneyId, setSelectedJourneyId] = useState("");
  const [nodeQuery, setNodeQuery] = useState("");
  const [layoutMemory, setLayoutMemory] = useState<LayoutMemory>({});
  const [nodes, setNodes, onNodesChange] = useNodesState<JourneyFlowNode>([]);
  const [edges, setEdges] = useState<JourneyFlowEdge[]>([]);
  const deferredSourceText = useDeferredValue(sourceText);
  const { fitView } = useReactFlow<JourneyFlowNode, JourneyFlowEdge>();

  useEffect(() => {
    let cancelled = false;

    async function runAnalysis() {
      if (deferredSourceText.trim().length === 0) {
        if (!cancelled) {
          setAnalysis({
            documents: [],
            diagnostics: [],
            graph: null
          });
        }
        return;
      }

      try {
        const parsed = JSON.parse(deferredSourceText) as unknown;
        const documents = normalizeDocuments(parsed);
        const entry = documents[0]?.source ?? "memory://workspace/document-1.jsonld";

        try {
          const graph = await compileGraphIR({
            kind: "memory",
            entry,
            documents
          });

          if (!cancelled) {
            setAnalysis({
              documents,
              diagnostics: graph.warnings,
              graph
            });
          }
        } catch (error) {
          if (!cancelled) {
            if (error instanceof GraphCompileError) {
              setAnalysis({
                documents,
                diagnostics: error.diagnostics,
                graph: null
              });
              return;
            }

            setAnalysis({
              documents: [],
              diagnostics: [],
              graph: null,
              parseError: error instanceof Error ? error.message : String(error)
            });
          }
        }
      } catch (error) {
        if (!cancelled) {
          setAnalysis({
            documents: [],
            diagnostics: [],
            graph: null,
            parseError: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    void runAnalysis();

    return () => {
      cancelled = true;
    };
  }, [deferredSourceText]);

  const journeys = useMemo(
    () => analysis.graph?.journeys ?? [],
    [analysis.graph]
  );

  useEffect(() => {
    if (journeys.some((journey) => journey.id === selectedJourneyId)) {
      return;
    }

    setSelectedJourneyId(journeys[0]?.id ?? "");
  }, [journeys, selectedJourneyId]);

  const selectedJourney = useMemo<GraphIRJourney | null>(() => {
    if (!selectedJourneyId) {
      return null;
    }

    return analysis.graph?.journeys.find((journey) => journey.id === selectedJourneyId) ?? null;
  }, [analysis.graph, selectedJourneyId]);

  const flow = useMemo(
    () =>
      analysis.graph && selectedJourney
        ? createFlowGraph(analysis.graph, selectedJourney, { query: nodeQuery })
        : EMPTY_FLOW,
    [analysis.graph, nodeQuery, selectedJourney]
  );

  const renderSignature = useMemo(() => {
    if (!selectedJourney) {
      return "empty";
    }

    return [
      selectedJourney.id,
      selectedJourney.nodeIds.join("|"),
      selectedJourney.edges.map((edge) => edge.id).join("|")
    ].join("::");
  }, [selectedJourney]);

  useEffect(() => {
    const savedPositions = selectedJourneyId ? layoutMemory[selectedJourneyId] ?? {} : {};
    setNodes(applySavedPositions(flow.nodes, savedPositions));
    setEdges(flow.edges);
  }, [flow, selectedJourneyId, setNodes]);

  useEffect(() => {
    if (!selectedJourney) {
      return;
    }

    const handle = window.setTimeout(() => {
      void fitView({ duration: 220, padding: 0.22 });
    }, 50);

    return () => window.clearTimeout(handle);
  }, [fitView, renderSignature]);

  const errorCount =
    (analysis.parseError ? 1 : 0) +
    analysis.diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const warningCount = analysis.diagnostics.filter(
    (diagnostic) => diagnostic.severity === "warning"
  ).length;
  const matchedCount = flow.nodes.filter((node) => node.data.matchState === "matched").length;
  const isSearchActive = nodeQuery.trim().length > 0;

  function resetLayout() {
    if (!selectedJourneyId) {
      return;
    }

    setLayoutMemory((current) => {
      const next = { ...current };
      delete next[selectedJourneyId];
      return next;
    });
    setNodes(flow.nodes);
    window.setTimeout(() => {
      void fitView({ duration: 220, padding: 0.22 });
    }, 40);
  }

  function fitCanvas() {
    if (nodes.length === 0) {
      return;
    }

    void fitView({ duration: 220, padding: 0.22 });
  }

  return (
    <div className="app-shell">
      <div className="app-surface">
        <header className="app-header">
          <div className="app-heading">
            <p className="breadcrumbs">Workflows &rsaquo; UJG Graph &rsaquo; Sandbox</p>
            <h1>Sandbox</h1>
            <p className="lede">
              Paste one `UJGDocument` or an array of documents that follow Core and Graph ED,
              then drag nodes directly on the canvas to refine the rendered layout.
            </p>
          </div>

          <div className="header-metrics">
            <MetricCard label="Documents" value={analysis.documents.length} />
            <MetricCard label="Journeys" value={journeys.length} />
            <MetricCard label="Errors" tone="error" value={errorCount} />
            <MetricCard label="Warnings" tone="warning" value={warningCount} />
          </div>
        </header>

        <div className="workspace">
          <aside className="inspector">
            <section className="panel">
              <div className="panel__header">
                <div>
                  <p className="panel__eyebrow">Input</p>
                  <h2>UJG documents</h2>
                </div>
                <div className="button-row">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      startTransition(() => {
                        setSourceText(SAMPLE_INPUT);
                        setNodeQuery("");
                      });
                    }}
                  >
                    Load sample
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      startTransition(() => {
                        setSourceText("");
                        setNodeQuery("");
                      });
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <textarea
                aria-label="UJG document input"
                className="source-input"
                spellCheck={false}
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
              />

              <p className="panel__hint">
                Accepts a single document object or an array. Graph entities must live in
                `nodes`, and graph references must remain string IRIs.
              </p>
            </section>

            <section className="panel">
              <div className="panel__header panel__header--stack">
                <div>
                  <p className="panel__eyebrow">Validation</p>
                  <h2>Diagnostics</h2>
                </div>
                  <p className="panel__hint">
                  Parser issues are shown first. The rest comes from the compiler&apos;s Core + Graph
                  diagnostics.
                </p>
              </div>

              <ul className="diagnostic-list">
                {analysis.parseError ? (
                  <li className="diagnostic-item diagnostic-item--error">
                    <strong>PARSE</strong>
                    <span>{analysis.parseError}</span>
                  </li>
                ) : null}
                {analysis.diagnostics.map((diagnostic) => (
                  <li
                    key={JSON.stringify(diagnostic)}
                    className={`diagnostic-item diagnostic-item--${diagnostic.severity}`}
                  >
                    <strong>
                      {diagnostic.severity.toUpperCase()} {diagnostic.code}
                    </strong>
                    <span>{diagnostic.message}</span>
                  </li>
                ))}
                {!analysis.parseError && analysis.diagnostics.length === 0 && analysis.graph ? (
                  <li className="diagnostic-item diagnostic-item--ok">
                    <strong>OK</strong>
                    <span>The current payload compiled successfully to Graph IR.</span>
                  </li>
                ) : null}
              </ul>
            </section>
          </aside>

          <section className="workspace-main">
            <div className="canvas-toolbar">
              <div className="canvas-toolbar__group">
                <div>
                  <p className="panel__eyebrow">Journey graph</p>
                  <h2>Rendered journey</h2>
                </div>
                <label className="journey-picker">
                  <span>Journey</span>
                  <select
                    value={selectedJourneyId}
                    onChange={(event) => setSelectedJourneyId(event.target.value)}
                  >
                  {journeys.length === 0 ? <option value="">No journeys found</option> : null}
                  {journeys.map((journey) => (
                      <option key={journey.id} value={journey.id}>
                        {journey.id}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="canvas-toolbar__actions">
                <label className="search-field">
                  <span className="search-field__icon" aria-hidden="true">
                    ⌕
                  </span>
                  <input
                    type="search"
                    placeholder="Search nodes"
                    value={nodeQuery}
                    onChange={(event) => setNodeQuery(event.target.value)}
                  />
                </label>
                <button type="button" className="ghost-button" onClick={resetLayout}>
                  Reset layout
                </button>
                <button type="button" className="ghost-button" onClick={fitCanvas}>
                  Fit view
                </button>
              </div>
            </div>

            <div className="canvas-frame">
              <div className="canvas-caption">
                <span className="canvas-caption__primary">
                  {selectedJourney?.id ?? "No journey selected"}
                </span>
                <span className="canvas-caption__secondary">
                  {isSearchActive
                    ? matchedCount > 0
                      ? `${matchedCount} match${matchedCount === 1 ? "" : "es"}`
                      : "No matches"
                    : "Drag nodes to refine the layout"}
                </span>
              </div>

              <ReactFlow<JourneyFlowNode, JourneyFlowEdge>
                edges={edges}
                fitViewOptions={{ padding: 0.22 }}
                maxZoom={1.45}
                minZoom={0.4}
                nodeTypes={nodeTypes}
                nodes={nodes}
                nodesConnectable={false}
                onNodeDragStop={(_event, node) => {
                  if (!selectedJourneyId) {
                    return;
                  }

                  setLayoutMemory((current) => ({
                    ...current,
                    [selectedJourneyId]: {
                      ...(current[selectedJourneyId] ?? {}),
                      [node.id]: node.position
                    }
                  }));
                }}
                onNodesChange={onNodesChange}
                panOnDrag
                proOptions={{ hideAttribution: true }}
                selectionOnDrag={false}
              >
                <MiniMap
                  className="playground-minimap"
                  pannable
                  zoomable
                  nodeBorderRadius={12}
                  nodeColor={(node) =>
                    node.data?.kind === "CompositeState" ? "#f3e7da" : "#e9eefb"
                  }
                />
                <Controls position="bottom-left" showInteractive={false} />
                <Background
                  color="rgba(142, 153, 179, 0.33)"
                  gap={28}
                  size={1}
                  variant={BackgroundVariant.Dots}
                />
              </ReactFlow>

              {!selectedJourney ? (
                <div className="empty-state">
                  <strong>No journey to render</strong>
                  <p>Paste valid UJG documents that compile to Graph IR, then select a journey.</p>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  tone = "neutral",
  value
}: {
  label: string;
  tone?: "neutral" | "error" | "warning";
  value: number;
}) {
  return (
    <div className={`metric-card metric-card--${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function normalizeDocuments(value: unknown): GraphIRMemoryDocument[] {
  const rawDocuments = Array.isArray(value) ? value : [value];

  if (rawDocuments.some((document) => !isJsonObject(document))) {
    throw new Error("Input must be a UJGDocument object or an array of UJGDocument objects.");
  }

  return rawDocuments.map((document, index) => ({
    source: getDocumentSource(document, index),
    document
  }));
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getDocumentSource(document: JsonObject, index: number): string {
  const documentId = typeof document["@id"] === "string" ? document["@id"] : undefined;

  if (documentId && /^(?:https?|file|memory):/i.test(documentId)) {
    return documentId;
  }

  return `memory://workspace/document-${index + 1}.jsonld`;
}

function applySavedPositions(
  nodes: JourneyFlowNode[],
  positions: JourneyLayoutMemory
): JourneyFlowNode[] {
  return nodes.map((node) => {
    const savedPosition = positions[node.id];

    return savedPosition
      ? {
          ...node,
          position: savedPosition
        }
      : node;
  });
}

export default function App() {
  return (
    <ReactFlowProvider>
      <FlowWorkbench />
    </ReactFlowProvider>
  );
}
