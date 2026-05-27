import { getWorkspaceApi } from "./workspaceApiRuntime";
import type {
  CreateGitCommitRequest,
  GetGitFileDiffRequest,
  GetGitLogRequest,
  GetGitRepositoryStatusRequest,
  GitCommitResponse,
  GitFileDiff,
  GitLog,
  GitRepositoryStatus,
} from "./types";

export function getGitRepositoryStatus(
  request: GetGitRepositoryStatusRequest,
): Promise<GitRepositoryStatus | null> {
  return getWorkspaceApi().getGitRepositoryStatus(request);
}

export function getGitFileDiff(
  request: GetGitFileDiffRequest,
): Promise<GitFileDiff | null> {
  return getWorkspaceApi().getGitFileDiff(request);
}

export function getGitLog(request: GetGitLogRequest): Promise<GitLog | null> {
  return getWorkspaceApi().getGitLog(request);
}

export function createGitCommit(
  request: CreateGitCommitRequest,
): Promise<GitCommitResponse | null> {
  return getWorkspaceApi().createGitCommit(request);
}
