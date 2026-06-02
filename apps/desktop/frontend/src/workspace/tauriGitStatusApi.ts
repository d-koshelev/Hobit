import { invoke } from "@tauri-apps/api/core";
import type {
  GetGitRepositoryStatusRequest,
  GitRepositoryStatus,
} from "./types";

type TauriGitRepositoryStatus = {
  branch: TauriGitBranchStatus | null;
  working_tree: TauriGitWorkingTreeStatus;
  changed_files: TauriGitFileChange[];
  last_commit: TauriGitLastCommit | null;
  warnings: string[];
};

type TauriGitBranchStatus = {
  name: string | null;
  upstream: string | null;
  ahead: number | null;
  behind: number | null;
  is_detached: boolean;
};

type TauriGitWorkingTreeStatus = {
  is_clean: boolean;
  is_dirty: boolean;
  staged_count: number;
  unstaged_count: number;
  untracked_count: number;
};

type TauriGitFileChange = {
  area: string;
  kind: string;
  path: string;
  original_path: string | null;
};

type TauriGitLastCommit = {
  hash: string;
  title: string;
  author: string | null;
  committed_at: string | null;
};

export async function getGitRepositoryStatus(
  request: GetGitRepositoryStatusRequest,
): Promise<GitRepositoryStatus | null> {
  const status = await invoke<TauriGitRepositoryStatus | null>(
    "get_git_repository_status",
    {
      request: {
        workspace_id: request.workspaceId,
        workbench_id: request.workbenchId,
        widget_instance_id: request.widgetInstanceId,
        repository_root: request.repositoryRoot,
      },
    },
  );

  return status ? normalizeGitRepositoryStatus(status) : null;
}

export function normalizeGitRepositoryStatus(
  status: TauriGitRepositoryStatus,
): GitRepositoryStatus {
  return {
    branch: status.branch
      ? {
          name: status.branch.name,
          upstream: status.branch.upstream,
          ahead: status.branch.ahead,
          behind: status.branch.behind,
          isDetached: status.branch.is_detached,
        }
      : null,
    workingTree: {
      isClean: status.working_tree.is_clean,
      isDirty: status.working_tree.is_dirty,
      stagedCount: status.working_tree.staged_count,
      unstagedCount: status.working_tree.unstaged_count,
      untrackedCount: status.working_tree.untracked_count,
    },
    changedFiles: status.changed_files.map((change) => ({
      area: change.area,
      kind: change.kind,
      path: change.path,
      originalPath: change.original_path,
    })),
    lastCommit: status.last_commit
      ? {
          hash: status.last_commit.hash,
          title: status.last_commit.title,
          author: status.last_commit.author,
          committedAt: status.last_commit.committed_at,
        }
      : null,
    warnings: status.warnings,
  };
}
