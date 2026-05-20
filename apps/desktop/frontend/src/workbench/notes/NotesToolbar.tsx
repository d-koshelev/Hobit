import type { ReactNode } from "react";
import { Button } from "../../design-system/Button";

export function NotesToolbar({
  apiAvailable,
  frameActions,
  isCreating,
  isLoading,
  isSaving,
  onCreateNote,
  onRefreshNotes,
}: {
  apiAvailable: boolean;
  frameActions: ReactNode;
  isCreating: boolean;
  isLoading: boolean;
  isSaving: boolean;
  onCreateNote: () => void | Promise<void>;
  onRefreshNotes: () => void | Promise<void>;
}) {
  return (
    <>
      <Button
        aria-label="Refresh notes"
        className="widget-icon-button"
        disabled={isLoading || isSaving || !apiAvailable}
        onClick={onRefreshNotes}
        title="Refresh notes"
        variant="ghost"
      >
        <span aria-hidden="true" className="button-icon-refresh" />
      </Button>
      <Button
        disabled={isCreating || isLoading || !apiAvailable}
        onClick={onCreateNote}
        variant="primary"
      >
        {isCreating ? "Creating" : "New note"}
      </Button>
      {frameActions}
    </>
  );
}
