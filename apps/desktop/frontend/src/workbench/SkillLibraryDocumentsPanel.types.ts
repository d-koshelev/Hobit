import type { WidgetRenderProps } from "./types";

export type SkillLibraryDocumentsPanelHandle = {
  startNewDocument: () => void;
};

export type SkillLibraryDocumentsToolbarState = {
  isNewDisabled: boolean;
};

export type SkillLibraryDocumentsPanelProps = {
  isActive: boolean;
  onAttachContextToCoordinator: WidgetRenderProps["onAttachContextToCoordinator"];
  onAttachKnowledgeContextToQueueTask: WidgetRenderProps["onAttachKnowledgeContextToQueueTask"];
  onCreateAgentQueueTask: WidgetRenderProps["onCreateAgentQueueTask"];
  onCreateKnowledgeDocument: WidgetRenderProps["onCreateKnowledgeDocument"];
  onCreateSkill: WidgetRenderProps["onCreateSkill"];
  onDeleteKnowledgeDocument: WidgetRenderProps["onDeleteKnowledgeDocument"];
  onDeleteSkill: WidgetRenderProps["onDeleteSkill"];
  onGetKnowledgeDocument: WidgetRenderProps["onGetKnowledgeDocument"];
  onGetSkill: WidgetRenderProps["onGetSkill"];
  onListKnowledgeDocuments: WidgetRenderProps["onListKnowledgeDocuments"];
  onListKnowledgeDraftReviews: WidgetRenderProps["onListKnowledgeDraftReviews"];
  onListSkills: WidgetRenderProps["onListSkills"];
  onReadKnowledgeDocumentImportFile: WidgetRenderProps["onReadKnowledgeDocumentImportFile"];
  onRecordKnowledgeDraftReview: WidgetRenderProps["onRecordKnowledgeDraftReview"];
  onToolbarStateChange: (state: SkillLibraryDocumentsToolbarState) => void;
  onUpdateKnowledgeDocument: WidgetRenderProps["onUpdateKnowledgeDocument"];
  onUpdateSkill: WidgetRenderProps["onUpdateSkill"];
};
