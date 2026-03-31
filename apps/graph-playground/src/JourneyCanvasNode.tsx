import { Handle, Position, type NodeProps } from "@xyflow/react";

import type { JourneyFlowNode } from "./flow";

export function JourneyCanvasNode({
  data,
  selected
}: NodeProps<JourneyFlowNode>) {
  return (
    <div
      className={[
        "journey-card",
        selected ? "is-selected" : "",
        data.kind === "CompositeState" ? "is-composite" : "",
        data.matchState === "dimmed" ? "is-dimmed" : "",
        data.matchState === "matched" ? "is-matched" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Handle className="journey-card__handle" position={Position.Left} type="target" />

      <div className="journey-card__header">
        <div className="journey-card__glyph">
          {data.kind === "CompositeState" ? "C" : "S"}
        </div>
        <div className="journey-card__heading">
          <strong className="journey-card__title">{data.label}</strong>
          <span>{data.kind === "CompositeState" ? "Composite state" : "State"}</span>
        </div>
        {data.isStartState ? <span className="journey-card__pill journey-card__pill--start">Start</span> : null}
      </div>

      <div className="journey-card__section">
        <div className="journey-card__pills">
          <span className="journey-card__pill">{data.membership}</span>
          {data.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="journey-card__pill journey-card__pill--tag">
              {tag}
            </span>
          ))}
        </div>

        {data.subjourneyId ? (
          <div className="journey-card__detail">
            <span>Subjourney</span>
            <strong title={data.subjourneyId}>{data.subjourneyId}</strong>
          </div>
        ) : null}
      </div>

      <div className="journey-card__section journey-card__section--meta">
        <div className="journey-card__detail">
          <span>Node ID</span>
          <strong title={data.nodeId}>{data.nodeId}</strong>
        </div>
        <div className="journey-card__detail">
          <span>Source</span>
          <strong title={data.source}>{data.source}</strong>
        </div>
      </div>

      <Handle className="journey-card__handle" position={Position.Right} type="source" />
    </div>
  );
}
