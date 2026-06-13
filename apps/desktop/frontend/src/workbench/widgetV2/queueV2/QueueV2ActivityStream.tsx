import { queueV2NextActionLabel } from "../../queue/queueV2NextActionModel";
import type { QueueV2ViewModel } from "../../queue/queueV2ViewModel";

type QueueV2ActivityStreamProps = {
  readonly viewModel: QueueV2ViewModel;
};

export function QueueV2ActivityStream({ viewModel }: QueueV2ActivityStreamProps) {
  const events = queueV2ActivityEvents(viewModel);
  const closedCount = viewModel.lanes.closed.length;

  return (
    <div className="queue-v2-activity-stream" aria-label="Queue v2 activity stream">
      <details>
        <summary>
          <span>Recent activity</span>
          <strong>{events.length.toString()}</strong>
        </summary>
        {events.length === 0 ? (
          <p>No recent queue activity</p>
        ) : (
          <ul>
            {events.map((event) => (
              <li key={event.id}>
                <span>{event.title}</span>
                <strong>{event.summary}</strong>
              </li>
            ))}
          </ul>
        )}
      </details>
      <details>
        <summary>
          <span>Closed history</span>
          <strong>{closedCount.toString()}</strong>
        </summary>
        {closedCount === 0 ? (
          <p>No closed tasks</p>
        ) : (
          <ul>
            {viewModel.lanes.closed.slice(0, 4).map((item) => (
              <li key={item.taskId}>
                <span>{item.title}</span>
                <strong>{queueV2NextActionLabel(item.nextAction)}</strong>
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}

function queueV2ActivityEvents(viewModel: QueueV2ViewModel) {
  return viewModel.tasks
    .filter(
      (item) =>
        item.lifecycle === "running" ||
        item.lifecycle === "report_ready" ||
        item.lifecycle === "review_required" ||
        item.lifecycle === "blocked" ||
        item.lifecycle === "failed",
    )
    .slice(0, 5)
    .map((item) => ({
      id: `${item.taskId}:${item.lifecycle}`,
      summary: queueV2ActivitySummary(item.lifecycle),
      title: item.title,
    }));
}

function queueV2ActivitySummary(lifecycle: string) {
  switch (lifecycle) {
    case "running":
      return "Running";
    case "report_ready":
      return "Report ready";
    case "review_required":
      return "Review required";
    case "blocked":
      return "Blocked";
    case "failed":
      return "Failed";
    default:
      return "Updated";
  }
}
