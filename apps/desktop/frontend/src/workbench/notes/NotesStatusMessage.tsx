import type { ReactNode } from "react";
import { Badge } from "../../design-system/Badge";
import type { WorkspaceNote } from "../../workspace/types";

export function NotesFrameStatusBadge({
  apiAvailable,
  isDirty,
  isLoading,
  isSaving,
  loadError,
  selectedNote,
}: {
  apiAvailable: boolean;
  isDirty: boolean;
  isLoading: boolean;
  isSaving: boolean;
  loadError: string | null;
  selectedNote: WorkspaceNote | null;
}) {
  if (!apiAvailable) {
    return <Badge variant="warning">Unsupported</Badge>;
  }

  if (isLoading) {
    return <Badge variant="info">Loading</Badge>;
  }

  if (loadError) {
    return <Badge variant="warning">Unavailable</Badge>;
  }

  if (isSaving) {
    return <Badge variant="info">Saving</Badge>;
  }

  if (isDirty) {
    return <Badge variant="warning">Unsaved</Badge>;
  }

  return <Badge variant={selectedNote ? "success" : "neutral"}>
    {selectedNote ? "Saved" : "Ready"}
  </Badge>;
}

export function NotesStatusMessage({
  children,
  variant,
}: {
  children: ReactNode;
  variant: "error" | "warning";
}) {
  return (
    <p className={`notes-message notes-message-${variant}`} role="alert">
      {children}
    </p>
  );
}
