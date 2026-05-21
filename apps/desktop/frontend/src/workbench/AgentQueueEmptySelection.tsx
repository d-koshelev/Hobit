type AgentQueueEmptySelectionProps = {
  hasTasks?: boolean;
};

export function AgentQueueEmptySelection({
  hasTasks = true,
}: AgentQueueEmptySelectionProps) {
  return (
    <div className="agent-queue-empty-state">
      <p className="empty-state-title">
        {hasTasks ? "No task selected." : "No queue tasks yet."}
      </p>
      <p className="empty-state-text">
        {hasTasks
          ? "Select a task to plan, assign, or run it."
          : "Use New task to create the first Queue task."}
      </p>
    </div>
  );
}
