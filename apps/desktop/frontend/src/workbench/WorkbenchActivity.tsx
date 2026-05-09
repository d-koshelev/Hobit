import type { WorkbenchEventView } from "./viewState";

const RECENT_ACTIVITY_LIMIT = 5;

type WorkbenchActivityProps = {
  events: WorkbenchEventView[];
};

export function WorkbenchActivity({ events }: WorkbenchActivityProps) {
  const recentEvents = events.slice(-RECENT_ACTIVITY_LIMIT).reverse();

  return (
    <aside
      aria-labelledby="workbench-activity-title"
      className="workbench-activity"
    >
      <div className="workbench-activity-header">
        <h2 className="workbench-activity-title" id="workbench-activity-title">
          Recent activity
        </h2>
        <p className="workbench-activity-context">Workspace history</p>
      </div>
      {recentEvents.length > 0 ? (
        <ol className="workbench-activity-list">
          {recentEvents.map((event, index) => {
            const createdAt =
              typeof event.createdAt === "string" ? event.createdAt : "";

            return (
              <li
                className="workbench-activity-item"
                key={event.id || `${event.kind}-${index}`}
              >
                <span className="workbench-activity-label">
                  {eventLabel(event.kind)}
                </span>
                {createdAt ? (
                  <time
                    className="workbench-activity-time"
                    dateTime={eventDateTimeValue(createdAt)}
                  >
                    {formatEventTime(createdAt)}
                  </time>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="workbench-activity-empty">No recent activity yet.</p>
      )}
    </aside>
  );
}

function eventLabel(kind: string | null | undefined) {
  switch (kind) {
    case "workspace_created":
      return "Workspace created";
    case "workspace_opened":
      return "Workspace opened";
    case "widget_instance_added":
      return "Widget added";
    case "widget_state_updated":
      return "Widget state saved";
    case "widget_layout_updated":
      return "Widget layout updated";
    default:
      return humanizeEventKind(kind);
  }
}

function humanizeEventKind(kind: string | null | undefined) {
  const readableKind = (kind ?? "").trim().replace(/[_-]+/g, " ");

  if (!readableKind) {
    return "Workspace activity";
  }

  return readableKind.charAt(0).toUpperCase() + readableKind.slice(1);
}

function formatEventTime(value: string) {
  const date = parseEventDate(value);

  if (!date) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function eventDateTimeValue(value: string) {
  return parseEventDate(value)?.toISOString() ?? value;
}

function parseEventDate(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const numericTimestamp = Number(trimmedValue);
  const date = Number.isFinite(numericTimestamp)
    ? new Date(numericTimestamp * 1000)
    : new Date(trimmedValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}
