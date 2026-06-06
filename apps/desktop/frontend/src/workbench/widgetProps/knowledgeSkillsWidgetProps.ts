import type {
  CoordinatorAttachedContextInput,
  WidgetRenderProps,
} from "../types";
import type { WorkbenchWidgetInstanceActions } from "../useWorkbenchWidgetActions";

type KnowledgeSkillsActions = Pick<
  WorkbenchWidgetInstanceActions,
  | "createKnowledgeDocument"
  | "createAgentQueueTask"
  | "createSkill"
  | "deleteKnowledgeDocument"
  | "deleteSkill"
  | "getKnowledgeDocument"
  | "getSkill"
  | "listKnowledgeDraftReviews"
  | "listKnowledgeDocuments"
  | "listSkills"
  | "readKnowledgeDocumentImportFile"
  | "recordKnowledgeDraftReview"
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
    onCreateAgentQueueTask: actions.createAgentQueueTask,
    onCreateKnowledgeDocument: actions.createKnowledgeDocument,
    onCreateSkill: actions.createSkill,
    onDeleteKnowledgeDocument: actions.deleteKnowledgeDocument,
    onDeleteSkill: actions.deleteSkill,
    onGetKnowledgeDocument: actions.getKnowledgeDocument,
    onGetSkill: actions.getSkill,
    onListKnowledgeDocuments: actions.listKnowledgeDocuments,
    onListKnowledgeDraftReviews: actions.listKnowledgeDraftReviews,
    onListSkills: actions.listSkills,
    onReadKnowledgeDocumentImportFile: actions.readKnowledgeDocumentImportFile,
    onRecordKnowledgeDraftReview: actions.recordKnowledgeDraftReview,
    onUpdateKnowledgeDocument: actions.updateKnowledgeDocument,
    onUpdateSkill: actions.updateSkill,
  };
}
