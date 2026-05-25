export type SkillReviewStatus =
  | "draft"
  | "needs_review"
  | "reviewed"
  | "deprecated";

export type CreateSkillRequest = {
  workspaceId: string;
  title: string;
  whenToUse: string;
  prerequisites: string;
  steps: string;
  validation: string;
  risks: string;
  tags: string;
  reviewStatus: SkillReviewStatus;
};

export type ListSkillsRequest = {
  workspaceId: string;
};

export type GetSkillRequest = {
  workspaceId: string;
  skillId: string;
};

export type UpdateSkillRequest = {
  workspaceId: string;
  skillId: string;
  title: string;
  whenToUse: string;
  prerequisites: string;
  steps: string;
  validation: string;
  risks: string;
  tags: string;
  reviewStatus: SkillReviewStatus;
};

export type DeleteSkillRequest = {
  workspaceId: string;
  skillId: string;
};

export type Skill = {
  skillId: string;
  workspaceId: string;
  title: string;
  whenToUse: string;
  prerequisites: string;
  steps: string;
  validation: string;
  risks: string;
  tags: string;
  reviewStatus: SkillReviewStatus;
  createdAt: string;
  updatedAt: string;
};
