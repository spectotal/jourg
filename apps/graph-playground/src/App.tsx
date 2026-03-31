import {
  createGraphIndex,
  materializeJourney,
  validateGraph,
  type GraphDocumentInput,
  type GraphValidationResult,
  type JsonObject,
  type MaterializedJourneyGraph
} from "@jourg/graph";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider
} from "@xyflow/react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

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
            "urn:ujg:transition:checkout-to-profile"
          ],
          outgoingTransitionGroupRefs: ["urn:ujg:otg:global-header"]
        },
        {
          "@type": "Transition",
          "@id": "urn:ujg:transition:home-to-checkout",
          from: "urn:ujg:state:home",
          to: "urn:ujg:state:checkout-flow",
          label: "Buy Now"
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
          label: "Home Page",
          tags: ["phase:landing"]
        },
        {
          "@type": "CompositeState",
          "@id": "urn:ujg:state:checkout-flow",
          label: "Checkout Process",
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

interface Analysis {
  documents: GraphDocumentInput[];
  parseError?: string;
  validation: GraphValidationResult;
  index: ReturnType<typeof createGraphIndex>;
}

const nodeTypes = {
  journeyNode: JourneyCanvasNode
};

function FlowWorkbench() {
  const [sourceText, setSourceText] = useState(SAMPLE_INPUT);
  const [selectedJourneyId, setSelectedJourneyId] = useState("");
  const deferredSourceText = useDeferredValue(sourceText);

  const analysis = useMemo(() => analyzeSource(deferredSourceText), [deferredSourceText]);
  const journeys = useMemo(
    () => Array.from(analysis.index.journeys.values()).sort((left, right) => left.id.localeCompare(right.id)),
    [analysis.index]
  );

  useEffect(() => {
    if (journeys.some((journey) => journey.id === selectedJourneyId)) {
      return;
    }

    setSelectedJourneyId(journeys[0]?.id ?? "");
  }, [journeys, selectedJourneyId]);

  const materialized = useMemo<MaterializedJourneyGraph | null>(() => {
    if (!selectedJourneyId) {
      return null;
    }

    return materializeJourney(analysis.index, selectedJourneyId);
  }, [analysis.index, selectedJourneyId]);

  const flow = useMemo(
    () =>
      materialized?.journey
        ? createFlowGraph(materialized)
        : { nodes: [], edges: [] },
    [materialized]
  );

  const errorCount =
    (analysis.parseError ? 1 : 0) +
    analysis.validation.diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const warningCount = analysis.validation.diagnostics.filter(
    (diagnostic) => diagnostic.severity === "warning"
  ).length;

  return (
    <div className="app-shell">
      <section className="composer">
        <p className="eyebrow">Core + Graph schema</p>
        <h1>UJG Graph Playground</h1>
        <p className="lede">
          Paste one `UJGDocument` or an array of `UJGDocument`s. The playground reads Graph ED
          nodes from `nodes`, validates references, and renders the selected journey in React Flow.
        </p>

        <div className="button-row">
          <button type="button" onClick={() => setSourceText(SAMPLE_INPUT)}>
            Load sample
          </button>
          <button type="button" onClick={() => setSourceText("")}>
            Clear
          </button>
        </div>

        <textarea
          aria-label="UJG document input"
          className="source-input"
          spellCheck={false}
          value={sourceText}
          onChange={(event) => setSourceText(event.target.value)}
        />

        <div className="summary-grid">
          <div className="summary-chip">
            <strong>{analysis.documents.length}</strong>
            <span>documents</span>
          </div>
          <div className="summary-chip">
            <strong>{journeys.length}</strong>
            <span>journeys</span>
          </div>
          <div className="summary-chip error">
            <strong>{errorCount}</strong>
            <span>errors</span>
          </div>
          <div className="summary-chip warning">
            <strong>{warningCount}</strong>
            <span>warnings</span>
          </div>
        </div>

        <section className="diagnostics-card">
          <h2>Diagnostics</h2>
          <ul className="diagnostic-list">
            {analysis.parseError ? (
              <li>
                <strong>PARSE</strong>
                <span>{analysis.parseError}</span>
              </li>
            ) : null}
            {analysis.validation.diagnostics.map((diagnostic) => (
              <li key={JSON.stringify(diagnostic)}>
                <strong>
                  {diagnostic.severity.toUpperCase()} {diagnostic.code}
                </strong>
                <span>{diagnostic.message}</span>
              </li>
            ))}
            {!analysis.parseError && analysis.validation.diagnostics.length === 0 ? (
              <li>
                <strong>OK</strong>
                <span>The current payload satisfies the implemented Core and Graph shape assumptions.</span>
              </li>
            ) : null}
          </ul>
        </section>
      </section>

      <section className="viewer">
        <div className="viewer-toolbar">
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

        <div className="canvas-frame">
          <ReactFlow<JourneyFlowNode, JourneyFlowEdge>
            key={selectedJourneyId || "empty"}
            fitView
            fitViewOptions={{ padding: 0.18 }}
            edges={flow.edges}
            minZoom={0.35}
            nodes={flow.nodes}
            nodeTypes={nodeTypes}
            nodesConnectable={false}
            nodesDraggable={false}
            proOptions={{ hideAttribution: true }}
          >
            <MiniMap className="playground-minimap" pannable zoomable />
            <Controls position="bottom-right" />
            <Background
              color="rgba(24, 63, 96, 0.18)"
              gap={22}
              size={1.1}
              variant={BackgroundVariant.Cross}
            />
          </ReactFlow>

          {!materialized?.journey ? (
            <div className="empty-state">
              <strong>No journey to render</strong>
              <p>Paste a valid `UJGDocument` payload with Graph ED nodes in `nodes` and select a journey.</p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function analyzeSource(sourceText: string): Analysis {
  if (sourceText.trim().length === 0) {
    const index = createGraphIndex([]);
    return {
      documents: [],
      validation: validateGraph(index),
      index
    };
  }

  try {
    const parsed = JSON.parse(sourceText) as unknown;
    const documents = normalizeDocuments(parsed);
    const index = createGraphIndex(documents);

    return {
      documents,
      validation: validateGraph(index),
      index
    };
  } catch (error) {
    const index = createGraphIndex([]);
    return {
      documents: [],
      parseError: error instanceof Error ? error.message : String(error),
      validation: validateGraph(index),
      index
    };
  }
}

function normalizeDocuments(value: unknown): GraphDocumentInput[] {
  const rawDocuments = Array.isArray(value) ? value : [value];

  if (rawDocuments.some((document) => !isJsonObject(document))) {
    throw new Error("Input must be a UJGDocument object or an array of UJGDocument objects.");
  }

  return rawDocuments.map((document, index) => ({
    source:
      typeof document["@id"] === "string" ? document["@id"] : `document-${index + 1}`,
    document
  }));
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export default function App() {
  return (
    <ReactFlowProvider>
      <FlowWorkbench />
    </ReactFlowProvider>
  );
}
