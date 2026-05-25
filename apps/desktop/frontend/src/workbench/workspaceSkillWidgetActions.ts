import {
  createSkill,
  deleteSkill,
  getSkill,
  listSkills,
  updateSkill,
} from "../workspace/workspaceApi";
import type {
  CreateSkillRequest,
  DeleteSkillRequest,
  Skill,
  UpdateSkillRequest,
} from "../workspace/types";
import type { WorkbenchViewState } from "./types";

export type SkillCreateRequest = Omit<CreateSkillRequest, "workspaceId">;
export type SkillUpdateRequest = Omit<UpdateSkillRequest, "workspaceId">;
export type SkillDeleteRequest = Omit<DeleteSkillRequest, "workspaceId">;

export type WorkspaceSkillWidgetActions = {
  createSkill: (request: SkillCreateRequest) => Promise<Skill>;
  listSkills: () => Promise<Skill[]>;
  getSkill: (skillId: string) => Promise<Skill | null>;
  updateSkill: (request: SkillUpdateRequest) => Promise<Skill | null>;
  deleteSkill: (request: SkillDeleteRequest) => Promise<boolean>;
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
  };
}

function requireOpenWorkbench(viewState: WorkbenchViewState, action: string) {
  if (!viewState.workbench.id) {
    throw new Error(`A workbench must be open to ${action}.`);
  }
}
