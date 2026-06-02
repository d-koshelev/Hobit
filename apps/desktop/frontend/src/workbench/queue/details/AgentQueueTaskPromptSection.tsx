import { promptSummary } from "./agentQueueTaskDetailsFormatters";

export function AgentQueueTaskPromptSection({ prompt }: { prompt: string }) {
  const promptText = prompt || "No prompt has been written for this task.";
  const summary = promptSummary(promptText);

  return (
    <section
      aria-label="Prompt summary"
      className="agent-queue-expanded-section agent-queue-prompt-preview"
    >
      <div>
        <p className="agent-queue-expanded-kicker">Prompt summary</p>
        <p className="agent-queue-prompt-preview-text">
          {summary}
        </p>
      </div>
      <details className="agent-queue-details agent-queue-secondary-details">
        <summary>Full prompt</summary>
        <pre>{promptText}</pre>
      </details>
    </section>
  );
}
