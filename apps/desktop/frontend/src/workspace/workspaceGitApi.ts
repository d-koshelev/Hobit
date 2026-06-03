import { getWorkspaceApi } from "./workspaceApiRuntime";
import type {
  CreateWorkspaceGitCommitRequest,
  GetWorkspaceGitDiffSummaryRequest,
  GetWorkspaceGitFileDiffRequest,
  GetWorkspaceGitLogRequest,
  GetWorkspaceGitStatusRequest,
  GitCommitResponse,
  GitFileDiff,
  GitLog,
  GitPushResponse,
  GitRepositoryStatus,
  PushWorkspaceGitRequest,
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

export function getWorkspaceGitLog(
  request: GetWorkspaceGitLogRequest,
): Promise<GitLog> {
  return getWorkspaceApi().getWorkspaceGitLog(request);
}

export function createWorkspaceGitCommit(
  request: CreateWorkspaceGitCommitRequest,
): Promise<GitCommitResponse> {
  return getWorkspaceApi().createWorkspaceGitCommit(request);
}

export function pushWorkspaceGit(
  request: PushWorkspaceGitRequest,
): Promise<GitPushResponse> {
  return getWorkspaceApi().pushWorkspaceGit(request);
}
