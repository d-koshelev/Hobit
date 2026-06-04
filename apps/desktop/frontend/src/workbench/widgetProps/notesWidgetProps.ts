import type { WidgetRenderProps } from "../types";
import type { WorkbenchWidgetInstanceActions } from "../useWorkbenchWidgetActions";

type NotesActions = Pick<
  WorkbenchWidgetInstanceActions,
  | "createKnowledgeDocument"
  | "createWorkspaceNote"
  | "getWorkspaceNote"
  | "listWorkspaceNotes"
  | "updateWorkspaceNote"
>;

export function notesWidgetProps(
  actions: NotesActions,
): Partial<WidgetRenderProps> {
  return {
    onCreateKnowledgeDocument: actions.createKnowledgeDocument,
    onCreateWorkspaceNote: actions.createWorkspaceNote,
    onGetWorkspaceNote: actions.getWorkspaceNote,
    onListWorkspaceNotes: actions.listWorkspaceNotes,
    onUpdateWorkspaceNote: actions.updateWorkspaceNote,
  };
}
