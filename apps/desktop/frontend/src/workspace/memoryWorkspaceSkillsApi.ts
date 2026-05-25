import type { Skill } from "./types";
import type { WorkspaceApi } from "./workspaceApiTypes";

const skillsByWorkspaceId = new Map<string, Skill[]>();
let nextSkillId = 1;

export const createSkill: WorkspaceApi["createSkill"] = async (request) => {
  const now = new Date().toISOString();
  const skill: Skill = {
    skillId: `dev_memory_skill_${nextSkillId++}`,
    workspaceId: request.workspaceId,
    title: request.title,
    whenToUse: request.whenToUse,
    prerequisites: request.prerequisites,
    steps: request.steps,
    validation: request.validation,
    risks: request.risks,
    tags: request.tags,
    reviewStatus: request.reviewStatus,
    createdAt: now,
    updatedAt: now,
  };

  const skills = getWorkspaceSkills(request.workspaceId);
  skillsByWorkspaceId.set(request.workspaceId, [skill, ...skills]);

  return cloneSkill(skill);
};

export const listSkills: WorkspaceApi["listSkills"] = async (request) => {
  return getSortedWorkspaceSkills(request.workspaceId).map(cloneSkill);
};

export const getSkill: WorkspaceApi["getSkill"] = async (request) => {
  const skill =
    getWorkspaceSkills(request.workspaceId).find(
      (candidate) => candidate.skillId === request.skillId,
    ) ?? null;

  return skill ? cloneSkill(skill) : null;
};

export const updateSkill: WorkspaceApi["updateSkill"] = async (request) => {
  const skills = getWorkspaceSkills(request.workspaceId);
  const skillIndex = skills.findIndex(
    (skill) => skill.skillId === request.skillId,
  );

  if (skillIndex === -1) {
    return null;
  }

  const currentSkill = skills[skillIndex];
  const updatedSkill: Skill = {
    ...currentSkill,
    title: request.title,
    whenToUse: request.whenToUse,
    prerequisites: request.prerequisites,
    steps: request.steps,
    validation: request.validation,
    risks: request.risks,
    tags: request.tags,
    reviewStatus: request.reviewStatus,
    updatedAt: new Date().toISOString(),
  };
  skillsByWorkspaceId.set(
    request.workspaceId,
    skills.map((skill, index) => (index === skillIndex ? updatedSkill : skill)),
  );

  return cloneSkill(updatedSkill);
};

export const deleteSkill: WorkspaceApi["deleteSkill"] = async (request) => {
  const skills = getWorkspaceSkills(request.workspaceId);
  const nextSkills = skills.filter((skill) => skill.skillId !== request.skillId);

  if (nextSkills.length === skills.length) {
    return false;
  }

  skillsByWorkspaceId.set(request.workspaceId, nextSkills);
  return true;
};

function getWorkspaceSkills(workspaceId: string) {
  return skillsByWorkspaceId.get(workspaceId) ?? [];
}

function getSortedWorkspaceSkills(workspaceId: string) {
  return [...getWorkspaceSkills(workspaceId)].sort(compareSkills);
}

function compareSkills(left: Skill, right: Skill) {
  return right.updatedAt.localeCompare(left.updatedAt);
}

function cloneSkill(skill: Skill): Skill {
  return { ...skill };
}
