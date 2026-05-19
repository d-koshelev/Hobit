import { Badge } from "../design-system/Badge";
import type {
  JdbcConnector,
  JdbcConnectorStatus,
} from "../workspace/jdbcConnectorTypes";
import { statusLabel } from "./jdbcConnectorWidgetModel";

export function jdbcConnectorFrameStatus({
  apiAvailable,
  isDirty,
  isLoading,
  isSaving,
  loadError,
  selectedConnector,
}: {
  apiAvailable: boolean;
  isDirty: boolean;
  isLoading: boolean;
  isSaving: boolean;
  loadError: string | null;
  selectedConnector: JdbcConnector | null;
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

  return (
    <Badge variant={selectedConnector ? "info" : "neutral"}>Preview</Badge>
  );
}

export function JdbcConnectorStatusChip({
  status,
}: {
  status: JdbcConnectorStatus;
}) {
  const variant =
    status === "configured"
      ? "success"
      : status === "error"
        ? "error"
        : status === "disabled"
          ? "warning"
          : "neutral";

  return <Badge variant={variant}>{statusLabel(status)}</Badge>;
}
