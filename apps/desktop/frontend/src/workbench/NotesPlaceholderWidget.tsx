import { useEffect, useId, useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import type { WidgetRenderProps } from "./types";

export function NotesPlaceholderWidget({
  instance,
  onUpdateState,
  title,
}: WidgetRenderProps) {
  const noteBody = getNoteBody(instance.state);
  const textareaId = useId();
  const [draft, setDraft] = useState(noteBody);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isDirty = draft !== noteBody;

  useEffect(() => {
    setDraft(noteBody);
    setErrorMessage(null);
  }, [instance.id, noteBody]);

  async function saveDraft() {
    if (!onUpdateState || isSaving) {
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      await onUpdateState(instance.id, {
        ...instance.state,
        body: draft,
      });
    } catch (error) {
      setErrorMessage(errorToMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <WidgetFrame
      actions={
        <Button
          disabled={!onUpdateState || !isDirty || isSaving}
          onClick={saveDraft}
          variant="primary"
        >
          {isSaving ? "Saving" : "Save"}
        </Button>
      }
      status={<Badge variant="neutral">Placeholder</Badge>}
      subtitle="Workspace note draft"
      title={title}
    >
      <textarea
        aria-label={`${title} body`}
        className="input notes-textarea"
        id={textareaId}
        onChange={(event) => setDraft(event.currentTarget.value)}
        value={draft}
      />
      {errorMessage ? (
        <p className="empty-state-text" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </WidgetFrame>
  );
}

function getNoteBody(state: Record<string, unknown>): string {
  return typeof state.body === "string" ? state.body : "";
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to save notes.";
}
