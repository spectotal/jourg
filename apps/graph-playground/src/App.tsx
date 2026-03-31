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
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState
} from "react";

import {
  createFlowGraph,
  type JourneyFlowEdge,
  type JourneyFlowNode
} from "./flow";
import { JourneyCanvasNode } from "./JourneyCanvasNode";
import { createSampleDrafts, type SampleDraft } from "./sampleDocs";

interface DocumentDraft {
  id: string;
  name: string;
  text: string;
}

interface DraftAnalysis {
  documents: GraphDocumentInput[];
  parseErrors: Map<string, string>;
  validation: GraphValidationResult;
  index: ReturnType<typeof createGraphIndex>;
  journeys: ReturnType<typeof createGraphIndex>["journeys"];
}

const STORAGE_KEY = "jourg:graph-playground:v1";

const nodeTypes = {
  journeyNode: JourneyCanvasNode
};

function FlowWorkbench() {
  const [drafts, setDrafts] = useState(loadDrafts);
  const [selectedJourneyId, setSelectedJourneyId] = useState("");
  const deferredDrafts = useDeferredValue(drafts);

  const analysis = useMemo(() => analyzeDrafts(deferredDrafts), [deferredDrafts]);
  const journeys = useMemo(
    () => Array.from(analysis.journeys.values()).sort((left, right) => left.id.localeCompare(right.id)),
    [analysis.journeys]
  );

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  }, [drafts]);

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
    Array.from(analysis.parseErrors.values()).length +
    analysis.validation.diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const warningCount = analysis.validation.diagnostics.filter(
    (diagnostic) => diagnostic.severity === "warning"
  ).length;

  const serializedGraph = useMemo(
    () => (materialized ? JSON.stringify(materialized, null, 2) : "Select a journey to inspect the effective graph."),
    [materialized]
  );

  function updateDraft(id: string, patch: Partial<DocumentDraft>) {
    startTransition(() => {
      setDrafts((current) =>
        current.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft))
      );
    });
  }

  function addDraft() {
    startTransition(() => {
      setDrafts((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          name: `document-${current.length + 1}.json`,
          text: "{\n  \"type\": \"UJGDocument\",\n  \"specVersion\": \"1.0\",\n  \"items\": []\n}"
        }
      ]);
    });
  }

  function removeDraft(id: string) {
    startTransition(() => {
      setDrafts((current) => (current.length > 1 ? current.filter((draft) => draft.id !== id) : current));
    });
  }

  function resetSamples() {
    startTransition(() => {
      setDrafts(createSampleDrafts());
    });
  }

  return (
    <div className="playground-shell">
      <aside className="panel panel--left">
        <p className="eyebrow">Graph ED implementation</p>
        <h1>UJG Graph Playground</h1>
        <p className="lede">
          Paste one or more UJG JSON documents, select a journey, and inspect the
          effective graph that results after Graph-spec validation and outgoing-transition-group injection.
        </p>

        <div className="button-row">
          <button type="button" onClick={addDraft}>
            Add document
          </button>
          <button type="button" onClick={resetSamples}>
            Load sample
          </button>
        </div>

        <div className="editor-stack">
          {drafts.map((draft) => (
            <section className="editor-card" key={draft.id}>
              <div className="editor-card__header">
                <input
                  aria-label="Document name"
                  value={draft.name}
                  onChange={(event) => updateDraft(draft.id, { name: event.target.value })}
                />
                <button
                  className="button-ghost"
                  type="button"
                  onClick={() => removeDraft(draft.id)}
                  disabled={drafts.length === 1}
                >
                  Remove
                </button>
              </div>
              <textarea
                aria-label={`Document ${draft.name}`}
                value={draft.text}
                onChange={(event) => updateDraft(draft.id, { text: event.target.value })}
              />
              {analysis.parseErrors.get(draft.id) ? (
                <p className="inline-error">{analysis.parseErrors.get(draft.id)}</p>
              ) : (
                <p className="inline-ok">Parsed successfully.</p>
              )}
            </section>
          ))}
        </div>
      </aside>

      <main className="canvas-column">
        <section className="canvas-toolbar">
          <div>
            <p className="toolbar-label">Journey</p>
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
          </div>

          <div className="stat-rack">
            <div className="stat-pill">
              <strong>{analysis.documents.length}</strong>
              <span>documents</span>
            </div>
            <div className="stat-pill">
              <strong>{journeys.length}</strong>
              <span>journeys</span>
            </div>
            <div className="stat-pill">
              <strong>{materialized?.nodes.length ?? 0}</strong>
              <span>nodes</span>
            </div>
            <div className="stat-pill">
              <strong>{materialized?.edges.length ?? 0}</strong>
              <span>edges</span>
            </div>
          </div>
        </section>

        <section className="canvas-frame">
          <ReactFlow<JourneyFlowNode, JourneyFlowEdge>
            key={selectedJourneyId || "empty"}
            fitView
            fitViewOptions={{ padding: 0.18 }}
            edges={flow.edges}
            elementsSelectable
            minZoom={0.3}
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
              <strong>No renderable journey yet</strong>
              <p>Fix parse or validation errors, or paste a UJG graph document with at least one Journey item.</p>
            </div>
          ) : null}
        </section>
      </main>

      <aside className="panel panel--right">
        <section className="info-card">
          <h2>Validation</h2>
          <div className="button-row button-row--stats">
            <div className="status-chip error">
              <strong>{errorCount}</strong>
              <span>errors</span>
            </div>
            <div className="status-chip warning">
              <strong>{warningCount}</strong>
              <span>warnings</span>
            </div>
          </div>
          <ul className="diagnostic-list">
            {Array.from(analysis.parseErrors.entries()).map(([draftId, message]) => (
              <li key={draftId}>
                <strong>Parse</strong>
                <span>{message}</span>
              </li>
            ))}
            {analysis.validation.diagnostics.map((diagnostic) => (
              <li key={JSON.stringify(diagnostic)}>
                <strong>
                  {diagnostic.severity.toUpperCase()} {diagnostic.code}
                </strong>
                <span>{diagnostic.message}</span>
              </li>
            ))}
            {analysis.parseErrors.size === 0 && analysis.validation.diagnostics.length === 0 ? (
              <li>
                <strong>OK</strong>
                <span>The current document set satisfies the implemented Graph ED checks.</span>
              </li>
            ) : null}
          </ul>
        </section>

        <section className="info-card">
          <h2>Effective Graph</h2>
          <p className="muted">
            Explicit transitions are rendered as solid edges. Outgoing-group injections are dashed. If both produce the same `from` / `to`, the edge is merged.
          </p>
          <pre className="json-preview">{serializedGraph}</pre>
        </section>
      </aside>
    </div>
  );
}

function analyzeDrafts(drafts: DocumentDraft[]): DraftAnalysis {
  const documents: GraphDocumentInput[] = [];
  const parseErrors = new Map<string, string>();

  for (const draft of drafts) {
    const trimmed = draft.text.trim();

    if (trimmed.length === 0) {
      continue;
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;

      if (!isJsonObject(parsed)) {
        parseErrors.set(draft.id, "Top-level JSON value must be an object.");
        continue;
      }

      documents.push({
        source: draft.name,
        document: parsed
      });
    } catch (error) {
      parseErrors.set(
        draft.id,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  const index = createGraphIndex(documents);
  const validation = validateGraph(index);

  return {
    documents,
    parseErrors,
    validation,
    index,
    journeys: index.journeys
  };
}

function loadDrafts(): DocumentDraft[] {
  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    return createSampleDrafts();
  }

  try {
    const parsed = JSON.parse(stored) as unknown;

    if (!Array.isArray(parsed)) {
      return createSampleDrafts();
    }

    const drafts = parsed
      .filter(isStoredDraft)
      .map((draft) => ({
        id: draft.id,
        name: draft.name,
        text: draft.text
      }));

    return drafts.length > 0 ? drafts : createSampleDrafts();
  } catch {
    return createSampleDrafts();
  }
}

function isStoredDraft(value: unknown): value is SampleDraft {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "name" in value &&
    "text" in value &&
    typeof (value as Record<string, unknown>).id === "string" &&
    typeof (value as Record<string, unknown>).name === "string" &&
    typeof (value as Record<string, unknown>).text === "string"
  );
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
