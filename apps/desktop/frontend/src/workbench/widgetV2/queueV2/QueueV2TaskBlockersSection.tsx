import type { QueueInspectorSnapshot } from "../../queue/queueV2ViewModel";

export function QueueV2TaskBlockersSection({
  inspector,
}: {
  inspector: QueueInspectorSnapshot;
}) {
  const blockers = [
    inspector.blockerSummary.primaryReason,
    ...inspector.blockerSummary.secondaryReasons,
  ].filter((reason): reason is string => Boolean(reason));

  return (
    <section
      aria-label="QueueV2 task blockers"
      className="queue-v2-task-details-block queue-v2-task-blockers"
    >
      <div className="queue-v2-task-blockers-header">
        <h3>Blockers</h3>
        <span>
          {blockers.length ? `${blockers.length.toString()} open` : "None"}
        </span>
      </div>
      {blockers.length ? (
        <ul>
          {blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      ) : (
        <p>No current blockers.</p>
      )}
      <div className="queue-v2-task-blocker-sources">
        <span>Dependencies</span>
        {inspector.dependencySummary.items.length ? (
          <ul>
            {inspector.dependencySummary.items.map((dependency) => (
              <li key={dependency.taskId}>
                {dependency.title}: {dependencyStatusLabel(dependency.status)}
              </li>
            ))}
          </ul>
        ) : (
          <p>No dependencies.</p>
        )}
      </div>
      {inspector.dependencySummary.gate === "failed" ? (
        <p>Blocked by failed dependency.</p>
      ) : null}
      {inspector.humanStatus.status === "needs_decision" ? (
        <p>Coordinator decision required.</p>
      ) : null}
      {inspector.blockerSummary.dependencyBlockerSources.length ? (
        <div className="queue-v2-task-blocker-sources">
          <span>Dependency sources</span>
          <ul>
            {inspector.blockerSummary.dependencyBlockerSources.map((source) => (
              <li key={source.taskId}>
                {source.taskId}: {source.title}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function dependencyStatusLabel(
  status: QueueInspectorSnapshot["dependencySummary"]["items"][number]["status"],
) {
  switch (status) {
    case "satisfied":
      return "satisfied";
    case "waiting":
      return "waiting";
    case "failed":
      return "failed";
    case "blocked":
      return "blocked";
    case "missing":
      return "missing";
    case "invalid":
      return "needs review";
  }
}
