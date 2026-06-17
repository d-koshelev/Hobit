import { useEffect, useId, useState } from "react";

import { Button, InlineError, Input, Notice } from "../../../../../design-system";
import type { AgentQueueTask } from "../../../../../workspace/types";
import type { AgentQueueController } from "../../../../queue/details/agentQueueTaskDetailsTypes";

type QueueV2TaskCodexSetupProps = {
  queue?: AgentQueueController;
  task: AgentQueueTask;
};

export function QueueV2TaskCodexSetup({
  queue,
  task,
}: QueueV2TaskCodexSetupProps) {
  const inputId = useId();
  const currentCodexExecutable = task.codexExecutable?.trim() ?? "";
  const [draft, setDraft] = useState(currentCodexExecutable);
  const [isEditing, setIsEditing] = useState(!currentCodexExecutable);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const unavailableReason = codexSetupUnavailableReason(queue);

  useEffect(() => {
    setDraft(currentCodexExecutable);
    setError(null);
    setMessage(null);
    setIsSaving(false);
    setIsEditing(!currentCodexExecutable);
  }, [currentCodexExecutable, task.queueItemId]);

  if (currentCodexExecutable && !isEditing && !message && !error) {
    return null;
  }

  async function saveCodexExecutable() {
    const codexExecutable = draft.trim();

    setError(null);
    setMessage(null);

    if (!codexExecutable) {
      setError("Enter a Codex executable before saving.");
      return;
    }

    const saveTaskCodexExecutable = queue?.run?.onSaveTaskCodexExecutable;

    if (unavailableReason || !saveTaskCodexExecutable) {
      setError(unavailableReason ?? "Queue task updates are unavailable.");
      return;
    }

    setIsSaving(true);

    try {
      const result = await saveTaskCodexExecutable(codexExecutable);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setMessage("Codex executable saved.");
      setIsEditing(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save Codex executable.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function cancelEdit() {
    setDraft(currentCodexExecutable);
    setError(null);
    setMessage(null);
    setIsSaving(false);
    setIsEditing(false);
  }

  return (
    <section
      aria-label="Task Codex executable setup"
      className="queue-v2-task-codex-setup"
    >
      <div className="queue-v2-task-codex-setup-header">
        <div>
          <h3>Codex executable</h3>
          <p>Queue needs a Codex executable on at least one task.</p>
        </div>
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)} variant="secondary">
            Set Codex executable
          </Button>
        ) : null}
      </div>

      {unavailableReason ? (
        <Notice variant="warning" title="Task update unavailable">
          {unavailableReason}
        </Notice>
      ) : null}

      {isEditing ? (
        <div className="queue-v2-task-codex-setup-form">
          <label className="field-label" htmlFor={inputId}>
            Codex executable
          </label>
          <Input
            autoComplete="off"
            disabled={isSaving || Boolean(unavailableReason)}
            id={inputId}
            onChange={(event) => setDraft(event.currentTarget.value)}
            placeholder="codex.cmd"
            spellCheck={false}
            type="text"
            value={draft}
          />
          <div className="queue-v2-task-codex-setup-actions">
            <Button
              disabled={isSaving || Boolean(unavailableReason)}
              onClick={() => void saveCodexExecutable()}
              variant="primary"
            >
              {isSaving ? "Saving" : "Save Codex executable"}
            </Button>
            <Button disabled={isSaving} onClick={cancelEdit} variant="ghost">
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {message ? (
        <p className="queue-v2-task-codex-setup-message">{message}</p>
      ) : null}
      {error ? <InlineError>{error}</InlineError> : null}
      <p className="queue-v2-task-codex-setup-note">
        Saving this setting does not enable Queue, start work, or change task
        readiness.
      </p>
    </section>
  );
}

function codexSetupUnavailableReason(queue: AgentQueueController | undefined) {
  if (!queue) {
    return "Queue task update actions are not wired in this view.";
  }

  if (!queue.apiAvailable) {
    return "Queue task updates are unavailable in this runtime.";
  }

  if (!queue.run?.canUpdateTaskSettings || !queue.run?.onSaveTaskCodexExecutable) {
    return "Queue task updates are unavailable in this runtime.";
  }

  return null;
}
