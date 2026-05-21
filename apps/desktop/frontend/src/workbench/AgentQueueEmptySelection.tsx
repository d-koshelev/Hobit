export function AgentQueueEmptySelection() {
  return (
    <div className="agent-queue-empty-state">
      <p className="empty-state-title">No task selected.</p>
      <p className="empty-state-text">
        Select a task to plan, assign, or run it.
      </p>
    </div>
  );
}
