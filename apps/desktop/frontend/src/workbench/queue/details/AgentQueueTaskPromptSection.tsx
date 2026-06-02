import { promptSummary } from "./agentQueueTaskDetailsFormatters";

export function AgentQueueTaskPromptSection({ prompt }: { prompt: string }) {
  const promptText = prompt.trim();
  const hasPrompt = promptText.length > 0;
  const summary = hasPrompt
    ? promptSummary(promptText)
    : "No prompt has been written for this task.";

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
      {hasPrompt ? (
        <details className="agent-queue-details agent-queue-secondary-details">
          <summary>Full prompt</summary>
          <pre>{promptText}</pre>
        </details>
      ) : null}
    </section>
  );
}
