import type { WidgetRenderProps } from "../types";
import type { WorkbenchWidgetInstanceActions } from "../useWorkbenchWidgetActions";

type NotesActions = Pick<
  WorkbenchWidgetInstanceActions,
  | "createWorkspaceNote"
  | "getWorkspaceNote"
  | "listWorkspaceNotes"
  | "updateWorkspaceNote"
>;

export function notesWidgetProps(
  actions: NotesActions,
): Partial<WidgetRenderProps> {
  return {
    onCreateWorkspaceNote: actions.createWorkspaceNote,
    onGetWorkspaceNote: actions.getWorkspaceNote,
    onListWorkspaceNotes: actions.listWorkspaceNotes,
    onUpdateWorkspaceNote: actions.updateWorkspaceNote,
  };
}
