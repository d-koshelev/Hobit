import { useState, type ReactNode } from "react";

import {
  RENDER_MEMORY_CAPS,
  cappedPreviewText,
} from "../../../renderMemoryGuards";
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
        <LazyDetails
          className="agent-queue-details agent-queue-secondary-details"
          summary="Full prompt"
        >
          <pre>
            {cappedPreviewText(
              promptText,
              RENDER_MEMORY_CAPS.transcriptPayloadChars,
            )}
          </pre>
        </LazyDetails>
      ) : null}
    </section>
  );
}

function LazyDetails({
  children,
  className,
  summary,
}: {
  children: ReactNode;
  className: string;
  summary: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <details
      className={className}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary>{summary}</summary>
      {isOpen ? children : null}
    </details>
  );
}
