import type { ReactNode } from "react";

export function DetailBlock({
  label,
  mono = false,
  value,
}: {
  label: string;
  mono?: boolean;
  value: ReactNode;
}) {
  return (
    <div className="queue-v2-task-details-block">
      <h3>{label}</h3>
      <p className={mono ? "queue-v2-task-details-mono" : undefined}>{value}</p>
    </div>
  );
}

export function CompactList({
  emptyLabel,
  items,
  label,
}: {
  emptyLabel: string;
  items: readonly string[];
  label: string;
}) {
  return (
    <div className="queue-v2-task-details-block">
      <h3>{label}</h3>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>{emptyLabel}</p>
      )}
    </div>
  );
}

export function EventList({ events }: { events: readonly string[] }) {
  return (
    <ol className="queue-v2-task-details-events">
      {events.map((event) => (
        <li key={event}>{event}</li>
      ))}
    </ol>
  );
}
