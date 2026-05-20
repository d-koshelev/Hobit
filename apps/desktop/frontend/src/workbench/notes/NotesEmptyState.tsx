export type NotesEmptyStateCopy = {
  text: string;
  title: string;
};

export function NotesEmptyState({
  compact = false,
  role,
  text,
  title,
}: {
  compact?: boolean;
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
      text: "Create one from the header to capture workspace notes.",
      title: "No notes yet.",
    };
  }

  return null;
}
