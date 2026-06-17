import type { QueueV2DraftReadiness } from "../../../../queue/queueV2DraftReadiness";

type QueueV2TaskDraftReadinessProps = {
  readiness: QueueV2DraftReadiness;
};

export function QueueV2TaskDraftReadiness({
  readiness,
}: QueueV2TaskDraftReadinessProps) {
  if (!readiness.isDraft) {
    return null;
  }

  return (
    <section
      aria-label="Draft readiness"
      className="queue-v2-task-draft-readiness"
    >
      <div className="queue-v2-task-draft-readiness-header">
        <div>
          <h3>Draft task</h3>
          <p>
            {readiness.readyToQueue
              ? "Required fields are present."
              : "Required fields are missing."}
          </p>
        </div>
        <span>{readiness.readyToQueue ? "Ready to queue" : "Not runnable yet"}</span>
      </div>
      {readiness.missingFields.length > 0 ? (
        <ul aria-label="Draft readiness blockers">
          {readiness.missingFields.map((field) => (
            <li key={field}>{field}</li>
          ))}
        </ul>
      ) : (
        <p>Queuing does not enable Queue or start work.</p>
      )}
    </section>
  );
}
