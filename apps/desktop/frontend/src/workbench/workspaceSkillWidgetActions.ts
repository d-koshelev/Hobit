import {
  createSkill,
  deleteSkill,
  getSkill,
  listSkills,
  updateSkill,
} from "../workspace/workspaceApi";
import {
  createKnowledgeDocument,
  deleteKnowledgeDocument,
  getKnowledgeDocument,
  listKnowledgeDocuments,
  searchKnowledgeDocuments,
  updateKnowledgeDocument,
} from "../workspace/workspaceApiKnowledgeDocuments";
import {
  listKnowledgeDraftReviews,
  recordKnowledgeDraftReview,
} from "../workspace/workspaceApiKnowledgeDraftReview";
import { readKnowledgeDocumentImportFile } from "../workspace/workspaceApiKnowledgeDocumentImport";
import type {
  CreateKnowledgeDocumentRequest,
  CreateSkillRequest,
  DeleteKnowledgeDocumentRequest,
  DeleteSkillRequest,
  KnowledgeDocumentImportFile,
  KnowledgeDocument,
  KnowledgeDraftReviewDecision,
  KnowledgeDocumentSearchResult,
  ListKnowledgeDraftReviewsRequest,
  RecordKnowledgeDraftReviewRequest,
  ReadKnowledgeDocumentImportFileRequest,
  SearchKnowledgeDocumentsRequest,
  Skill,
  UpdateKnowledgeDocumentRequest,
  UpdateSkillRequest,
} from "../workspace/types";
import type { WorkbenchViewState } from "./types";

export type SkillCreateRequest = Omit<CreateSkillRequest, "workspaceId">;
export type SkillUpdateRequest = Omit<UpdateSkillRequest, "workspaceId">;
export type SkillDeleteRequest = Omit<DeleteSkillRequest, "workspaceId">;
export type KnowledgeDocumentCreateRequest = Omit<
  CreateKnowledgeDocumentRequest,
  "workspaceId"
>;
export type KnowledgeDocumentUpdateRequest = Omit<
  UpdateKnowledgeDocumentRequest,
  "workspaceId"
>;
export type KnowledgeDocumentDeleteRequest = Omit<
  DeleteKnowledgeDocumentRequest,
  "workspaceId"
>;
export type KnowledgeDocumentSearchRequest = Omit<
  SearchKnowledgeDocumentsRequest,
  "workspaceId"
>;
export type KnowledgeDocumentImportFileRequest =
  ReadKnowledgeDocumentImportFileRequest;
export type KnowledgeDraftReviewRecordRequest = Omit<
  RecordKnowledgeDraftReviewRequest,
  "workspaceId"
>;
export type KnowledgeDraftReviewListRequest = Omit<
  ListKnowledgeDraftReviewsRequest,
  "workspaceId"
>;

export type WorkspaceSkillWidgetActions = {
  createSkill: (request: SkillCreateRequest) => Promise<Skill>;
  listSkills: () => Promise<Skill[]>;
  getSkill: (skillId: string) => Promise<Skill | null>;
  updateSkill: (request: SkillUpdateRequest) => Promise<Skill | null>;
  deleteSkill: (request: SkillDeleteRequest) => Promise<boolean>;
  createKnowledgeDocument?: (
    request: KnowledgeDocumentCreateRequest,
  ) => Promise<KnowledgeDocument>;
  listKnowledgeDocuments?: () => Promise<KnowledgeDocument[]>;
  getKnowledgeDocument?: (
    knowledgeDocumentId: string,
  ) => Promise<KnowledgeDocument | null>;
  updateKnowledgeDocument?: (
    request: KnowledgeDocumentUpdateRequest,
  ) => Promise<KnowledgeDocument | null>;
  deleteKnowledgeDocument?: (
    request: KnowledgeDocumentDeleteRequest,
  ) => Promise<boolean>;
  searchKnowledgeDocuments?: (
    request: KnowledgeDocumentSearchRequest,
  ) => Promise<KnowledgeDocumentSearchResult[]>;
  recordKnowledgeDraftReview?: (
    request: KnowledgeDraftReviewRecordRequest,
  ) => Promise<KnowledgeDraftReviewDecision>;
  listKnowledgeDraftReviews?: (
    request: KnowledgeDraftReviewListRequest,
  ) => Promise<KnowledgeDraftReviewDecision[]>;
  readKnowledgeDocumentImportFile?: (
    request: KnowledgeDocumentImportFileRequest,
  ) => Promise<KnowledgeDocumentImportFile>;
};

export function createWorkspaceSkillActions(
  viewState: WorkbenchViewState,
): WorkspaceSkillWidgetActions {
  return {
    createSkill: (request) => {
      requireOpenWorkbench(viewState, "create skills");
      return createSkill({
        workspaceId: viewState.workspace.id,
        ...request,
      });
    },
    getSkill: (skillId) => {
      requireOpenWorkbench(viewState, "read skills");
      return getSkill({
        workspaceId: viewState.workspace.id,
        skillId,
      });
    },
    listSkills: () => {
      requireOpenWorkbench(viewState, "read skills");
      return listSkills({
        workspaceId: viewState.workspace.id,
      });
    },
    updateSkill: (request) => {
      requireOpenWorkbench(viewState, "update skills");
      return updateSkill({
        workspaceId: viewState.workspace.id,
        ...request,
      });
    },
    deleteSkill: (request) => {
      requireOpenWorkbench(viewState, "delete skills");
      return deleteSkill({
        workspaceId: viewState.workspace.id,
        ...request,
      });
    },
    createKnowledgeDocument: (request) => {
      requireOpenWorkbench(viewState, "create knowledge documents");
      return createKnowledgeDocument({
        workspaceId: viewState.workspace.id,
        ...request,
      });
    },
    listKnowledgeDocuments: () => {
      requireOpenWorkbench(viewState, "read knowledge documents");
      return listKnowledgeDocuments({
        workspaceId: viewState.workspace.id,
      });
    },
    getKnowledgeDocument: (knowledgeDocumentId) => {
      requireOpenWorkbench(viewState, "read knowledge documents");
      return getKnowledgeDocument({
        workspaceId: viewState.workspace.id,
        knowledgeDocumentId,
      });
    },
    updateKnowledgeDocument: (request) => {
      requireOpenWorkbench(viewState, "update knowledge documents");
      return updateKnowledgeDocument({
        workspaceId: viewState.workspace.id,
        ...request,
      });
    },
    deleteKnowledgeDocument: (request) => {
      requireOpenWorkbench(viewState, "delete knowledge documents");
      return deleteKnowledgeDocument({
        workspaceId: viewState.workspace.id,
        ...request,
      });
    },
    searchKnowledgeDocuments: (request) => {
      requireOpenWorkbench(viewState, "search knowledge documents");
      return searchKnowledgeDocuments({
        workspaceId: viewState.workspace.id,
        ...request,
      });
    },
    recordKnowledgeDraftReview: (request) => {
      requireOpenWorkbench(viewState, "record draft Knowledge review decisions");
      return recordKnowledgeDraftReview({
        workspaceId: viewState.workspace.id,
        ...request,
      });
    },
    listKnowledgeDraftReviews: (request) => {
      requireOpenWorkbench(viewState, "read draft Knowledge review decisions");
      return listKnowledgeDraftReviews({
        workspaceId: viewState.workspace.id,
        ...request,
      });
    },
    readKnowledgeDocumentImportFile: (request) => {
      requireOpenWorkbench(viewState, "import knowledge documents");
      return readKnowledgeDocumentImportFile(request);
    },
  };
}

function requireOpenWorkbench(viewState: WorkbenchViewState, action: string) {
  if (!viewState.workbench.id) {
    throw new Error(`A workbench must be open to ${action}.`);
  }
}
