import { getWorkspaceApi } from "./workspaceApiRuntime";
import type {
  CreateSkillRequest,
  DeleteSkillRequest,
  GetSkillRequest,
  ListSkillsRequest,
  Skill,
  UpdateSkillRequest,
} from "./types";

export function createSkill(request: CreateSkillRequest): Promise<Skill> {
  return getWorkspaceApi().createSkill(request);
}

export function listSkills(request: ListSkillsRequest): Promise<Skill[]> {
  return getWorkspaceApi().listSkills(request);
}

export function getSkill(request: GetSkillRequest): Promise<Skill | null> {
  return getWorkspaceApi().getSkill(request);
}

export function updateSkill(
  request: UpdateSkillRequest,
): Promise<Skill | null> {
  return getWorkspaceApi().updateSkill(request);
}

export function deleteSkill(request: DeleteSkillRequest): Promise<boolean> {
  return getWorkspaceApi().deleteSkill(request);
}
