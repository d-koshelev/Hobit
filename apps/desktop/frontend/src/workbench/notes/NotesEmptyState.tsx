export type NotesEmptyStateCopy = {
  text: string;
  title: string;
};

export function NotesEmptyState({
  actionDisabled = false,
  actionLabel,
  compact = false,
  onAction,
  role,
  text,
  title,
}: {
  actionDisabled?: boolean;
  actionLabel?: string;
  compact?: boolean;
  onAction?: () => void | Promise<void>;
  role?: "alert";
  text: string;
  title: string;
}) {
  return (
    <div
      className={
        compact ? "notes-empty-state notes-empty-state-compact" : "notes-empty-state"
      }
      role={role}
    >
      <p className="empty-state-title">{title}</p>
      <p className="empty-state-text">{text}</p>
      {actionLabel && onAction ? (
        <button
          className="button button-primary notes-empty-state-action"
          disabled={actionDisabled}
          onClick={() => void onAction()}
          type="button"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function notesSingleState({
  isLoading,
  loadError,
  noteCount,
}: {
  isLoading: boolean;
  loadError: string | null;
  noteCount: number;
}): NotesEmptyStateCopy | null {
  if (isLoading) {
    return {
      text: "Loading workspace-local notes from desktop storage.",
      title: "Loading notes.",
    };
  }

  if (loadError) {
    return {
      text: loadError,
      title: "Notes unavailable.",
    };
  }

  if (noteCount === 0) {
    return {
      text: "Create a note to capture workspace context.",
      title: "No notes yet.",
    };
  }

  return null;
}
