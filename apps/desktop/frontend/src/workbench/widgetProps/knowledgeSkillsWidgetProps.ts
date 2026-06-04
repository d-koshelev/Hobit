import type {
  CoordinatorAttachedContextInput,
  WidgetRenderProps,
} from "../types";
import type { WorkbenchWidgetInstanceActions } from "../useWorkbenchWidgetActions";

type KnowledgeSkillsActions = Pick<
  WorkbenchWidgetInstanceActions,
  | "createKnowledgeDocument"
  | "createSkill"
  | "deleteKnowledgeDocument"
  | "deleteSkill"
  | "getKnowledgeDocument"
  | "getSkill"
  | "listKnowledgeDocuments"
  | "listSkills"
  | "readKnowledgeDocumentImportFile"
  | "updateKnowledgeDocument"
  | "updateSkill"
>;

type KnowledgeSkillsWidgetPropsOptions = {
  actions: KnowledgeSkillsActions;
  onAttachContextToCoordinator?: (
    request: CoordinatorAttachedContextInput,
  ) => void;
  onAttachKnowledgeContextToQueueTask?: WidgetRenderProps["onAttachKnowledgeContextToQueueTask"];
};

export function knowledgeSkillsWidgetProps({
  actions,
  onAttachContextToCoordinator,
  onAttachKnowledgeContextToQueueTask,
}: KnowledgeSkillsWidgetPropsOptions): Partial<WidgetRenderProps> {
  return {
    onAttachContextToCoordinator,
    onAttachKnowledgeContextToQueueTask,
    onCreateKnowledgeDocument: actions.createKnowledgeDocument,
    onCreateSkill: actions.createSkill,
    onDeleteKnowledgeDocument: actions.deleteKnowledgeDocument,
    onDeleteSkill: actions.deleteSkill,
    onGetKnowledgeDocument: actions.getKnowledgeDocument,
    onGetSkill: actions.getSkill,
    onListKnowledgeDocuments: actions.listKnowledgeDocuments,
    onListSkills: actions.listSkills,
    onReadKnowledgeDocumentImportFile: actions.readKnowledgeDocumentImportFile,
    onUpdateKnowledgeDocument: actions.updateKnowledgeDocument,
    onUpdateSkill: actions.updateSkill,
  };
}
