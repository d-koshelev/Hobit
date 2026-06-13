import { Badge } from "../design-system/Badge";
import type { AgentQueueTask } from "../workspace/types";

export function AgentQueueWidgetStatusBadge({
  apiAvailable,
  isDirty,
  isLoading,
  isSaving,
  loadError,
  selectedTask,
}: {
  apiAvailable: boolean;
  isDirty: boolean;
  isLoading: boolean;
  isSaving: boolean;
  loadError: string | null;
  selectedTask: AgentQueueTask | null;
}) {
  if (!apiAvailable) {
    return <Badge variant="warning">Unsupported</Badge>;
  }

  if (isLoading) {
    return <Badge variant="info">Loading</Badge>;
  }

  if (loadError) {
    return <Badge variant="error">Error</Badge>;
  }

  if (isSaving) {
    return <Badge variant="info">Saving</Badge>;
  }

  if (isDirty) {
    return <Badge variant="warning">Unsaved</Badge>;
  }

  return null;
}
