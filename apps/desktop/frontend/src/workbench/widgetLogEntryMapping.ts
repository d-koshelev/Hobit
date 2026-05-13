import type { WidgetLogEntry as WorkspaceWidgetLogEntry } from "../workspace/types";
import type { WidgetLogEntry } from "./types";

export function widgetLogEntryFromApi(
  log: WorkspaceWidgetLogEntry,
): WidgetLogEntry {
  return {
    id: log.id,
    widgetInstanceId: log.widgetInstanceId,
    runId: log.runId,
    level: log.level,
    message: log.message,
    payload: log.payload,
    createdAt: log.createdAt,
  };
}
