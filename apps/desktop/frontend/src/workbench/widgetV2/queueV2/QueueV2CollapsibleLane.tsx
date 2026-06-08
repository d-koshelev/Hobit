import { useState, type ReactNode } from "react";

type QueueV2CollapsibleLaneProps = {
  children: ReactNode;
  className: string;
  collapsedSummary?: ReactNode;
  count: number;
  dataAttributes?: Record<string, string>;
  defaultExpanded?: boolean;
  expandedClassName?: string;
  label: string;
  laneKey?: string;
};

export function QueueV2CollapsibleLane({
  children,
  className,
  collapsedSummary,
  count,
  dataAttributes = {},
  defaultExpanded = true,
  expandedClassName,
  label,
  laneKey,
}: QueueV2CollapsibleLaneProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const stateLabel = isExpanded ? "expanded" : "collapsed";
  const actionLabel = isExpanded ? "Collapse" : "Expand";
  const sectionDataAttributes = Object.fromEntries(
    Object.entries(dataAttributes).map(([key, value]) => [
      `data-${key}`,
      value === "state" ? stateLabel : value,
    ]),
  );

  return (
    <section
      aria-label={`${label} lane`}
      className={[className, isExpanded && expandedClassName ? expandedClassName : null]
        .filter(Boolean)
        .join(" ")}
      data-queue-v2-collapsible-lane={stateLabel}
      data-queue-v2-lane={laneKey}
      role="listitem"
      {...sectionDataAttributes}
    >
      <button
        aria-expanded={isExpanded}
        aria-label={`${actionLabel} ${label} lane, ${count.toString()} ${
          count === 1 ? "task" : "tasks"
        }`}
        className="queue-v2-collapsible-lane-header"
        onClick={() => setIsExpanded((current) => !current)}
        type="button"
      >
        <span aria-hidden="true" className="queue-v2-collapsible-lane-icon">
          {isExpanded ? "v" : ">"}
        </span>
        <span className="queue-v2-collapsible-lane-title">{label}</span>
        <strong>{count}</strong>
      </button>
      {isExpanded ? (
        <div className="queue-v2-collapsible-lane-body">{children}</div>
      ) : collapsedSummary ? (
        <div className="queue-v2-collapsible-lane-summary">{collapsedSummary}</div>
      ) : null}
    </section>
  );
}
