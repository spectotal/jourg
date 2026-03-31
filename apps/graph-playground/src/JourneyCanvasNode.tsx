import { Handle, Position, type NodeProps } from "@xyflow/react";

import type { JourneyFlowNode } from "./flow";

export function JourneyCanvasNode({
  data,
  selected
}: NodeProps<JourneyFlowNode>) {
  return (
    <div className={`journey-card ${selected ? "is-selected" : ""}`}>
      <Handle className="journey-card__handle" position={Position.Left} type="target" />
      <div className="journey-card__header">
        <span className={`journey-card__chip kind-${data.kind.toLowerCase()}`}>
          {data.kind === "CompositeState" ? "Composite" : "State"}
        </span>
        <span className={`journey-card__chip ${data.membership === "member" ? "member" : "referenced"}`}>
          {data.membership}
        </span>
      </div>
      <strong className="journey-card__title">{data.label}</strong>
      <div className="journey-card__meta">
        {data.isStartState ? <span className="journey-card__start">Start state</span> : null}
        {data.subjourneyId ? <span>Subjourney: {data.subjourneyId}</span> : null}
      </div>
      {data.tags.length > 0 ? (
        <div className="journey-card__tags">
          {data.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}
      <p className="journey-card__source">{data.source}</p>
      <Handle className="journey-card__handle" position={Position.Right} type="source" />
    </div>
  );
}
