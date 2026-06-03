import { getWorkspaceApi } from "./workspaceApiRuntime";
import type {
  CreateWorkspaceGitCommitRequest,
  GetWorkspaceGitDiffSummaryRequest,
  GetWorkspaceGitFileDiffRequest,
  GetWorkspaceGitStatusRequest,
  GitCommitResponse,
  GitFileDiff,
  GitRepositoryStatus,
  WorkspaceGitDiffSummary,
} from "./types";

export function getWorkspaceGitStatus(
  request: GetWorkspaceGitStatusRequest,
): Promise<GitRepositoryStatus> {
  return getWorkspaceApi().getWorkspaceGitStatus(request);
}

export function getWorkspaceGitDiffSummary(
  request: GetWorkspaceGitDiffSummaryRequest,
): Promise<WorkspaceGitDiffSummary> {
  return getWorkspaceApi().getWorkspaceGitDiffSummary(request);
}

export function getWorkspaceGitFileDiff(
  request: GetWorkspaceGitFileDiffRequest,
): Promise<GitFileDiff> {
  return getWorkspaceApi().getWorkspaceGitFileDiff(request);
}

export function createWorkspaceGitCommit(
  request: CreateWorkspaceGitCommitRequest,
): Promise<GitCommitResponse> {
  return getWorkspaceApi().createWorkspaceGitCommit(request);
}
