import { invoke } from "@tauri-apps/api/core";
import type {
  CreateSkillRequest,
  DeleteSkillRequest,
  GetSkillRequest,
  ListSkillsRequest,
  Skill,
  SkillReviewStatus,
  UpdateSkillRequest,
} from "./types";

type TauriSkill = {
  skill_id: string;
  workspace_id: string;
  title: string;
  when_to_use: string;
  prerequisites: string;
  steps: string;
  validation: string;
  risks: string;
  tags: string;
  review_status: SkillReviewStatus;
  created_at: string;
  updated_at: string;
};

export async function createSkill(
  request: CreateSkillRequest,
): Promise<Skill> {
  const skill = await invoke<TauriSkill>("create_skill", {
    request: toTauriCreateSkillRequest(request),
  });

  return normalizeSkill(skill);
}

export async function listSkills(
  request: ListSkillsRequest,
): Promise<Skill[]> {
  const skills = await invoke<TauriSkill[]>("list_skills", {
    request: {
      workspace_id: request.workspaceId,
    },
  });

  return skills.map(normalizeSkill);
}

export async function getSkill(
  request: GetSkillRequest,
): Promise<Skill | null> {
  const skill = await invoke<TauriSkill | null>("get_skill", {
    request: {
      workspace_id: request.workspaceId,
      skill_id: request.skillId,
    },
  });

  return skill ? normalizeSkill(skill) : null;
}

export async function updateSkill(
  request: UpdateSkillRequest,
): Promise<Skill | null> {
  const skill = await invoke<TauriSkill | null>("update_skill", {
    request: {
      workspace_id: request.workspaceId,
      skill_id: request.skillId,
      title: request.title,
      when_to_use: request.whenToUse,
      prerequisites: request.prerequisites,
      steps: request.steps,
      validation: request.validation,
      risks: request.risks,
      tags: request.tags,
      review_status: request.reviewStatus,
    },
  });

  return skill ? normalizeSkill(skill) : null;
}

export async function deleteSkill(
  request: DeleteSkillRequest,
): Promise<boolean> {
  return invoke<boolean>("delete_skill", {
    request: {
      workspace_id: request.workspaceId,
      skill_id: request.skillId,
    },
  });
}

function toTauriCreateSkillRequest(request: CreateSkillRequest) {
  return {
    workspace_id: request.workspaceId,
    title: request.title,
    when_to_use: request.whenToUse,
    prerequisites: request.prerequisites,
    steps: request.steps,
    validation: request.validation,
    risks: request.risks,
    tags: request.tags,
    review_status: request.reviewStatus,
  };
}

function normalizeSkill(skill: TauriSkill): Skill {
  return {
    skillId: skill.skill_id,
    workspaceId: skill.workspace_id,
    title: skill.title,
    whenToUse: skill.when_to_use,
    prerequisites: skill.prerequisites,
    steps: skill.steps,
    validation: skill.validation,
    risks: skill.risks,
    tags: skill.tags,
    reviewStatus: skill.review_status,
    createdAt: skill.created_at,
    updatedAt: skill.updated_at,
  };
}
