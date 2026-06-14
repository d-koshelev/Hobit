import { Notice, Section } from "../../../../../design-system";
import { EventList } from "./QueueV2TaskDetailsShared";

export function QueueV2TaskDetailsActivity({
  events,
}: {
  events: readonly string[];
}) {
  return (
    <div className="queue-v2-task-details-section">
      <Notice variant="info">
        High-level task timeline only. Raw events and payloads are in Debug.
      </Notice>
      <Section compact title="Timeline">
        <EventList events={events} />
      </Section>
    </div>
  );
}
