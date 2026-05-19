import { getWorkspaceApi } from "./workspaceApiRuntime";
import type {
  CreateGitCommitRequest,
  GetGitRepositoryStatusRequest,
  GitCommitResponse,
  GitRepositoryStatus,
} from "./types";

export function getGitRepositoryStatus(
  request: GetGitRepositoryStatusRequest,
): Promise<GitRepositoryStatus | null> {
  return getWorkspaceApi().getGitRepositoryStatus(request);
}

export function createGitCommit(
  request: CreateGitCommitRequest,
): Promise<GitCommitResponse | null> {
  return getWorkspaceApi().createGitCommit(request);
}
