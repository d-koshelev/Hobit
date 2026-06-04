import type { WorkbenchViewState } from "../workbench/types";
import { createWorkbenchViewStateFromWorkspaceState } from "../workbench/viewState";
import {
  getWorkspaceWorkbenchState,
  openWorkspace as openWorkspaceCommand,
} from "./workspaceApi";
import {
  clearLastOpenWorkspaceRecord,
  readLastOpenWorkspaceRecord,
  saveLastOpenWorkspaceRecord,
  type LastOpenWorkspaceRecord,
} from "./workspaceRecoveryStorage";
import type { WorkspaceSummary, WorkspaceWorkbenchState } from "./types";

export type WorkspaceRecoveryNotice = {
  title: string;
  message: string;
};

export type WorkspaceRecoveryResult =
  | {
      kind: "none";
    }
  | {
      kind: "restored";
      viewState: WorkbenchViewState;
      workspace: WorkspaceSummary;
    }
  | {
      kind: "failed";
      notice: WorkspaceRecoveryNotice;
    };

export type WorkspaceRecoveryPassState = {
  promise: Promise<WorkspaceRecoveryResult> | null;
};

export type WorkspaceRecoveryStateSink = {
  setIsRecoveringWorkspace: (isRecovering: boolean) => void;
  setRecoveryNotice: (notice: WorkspaceRecoveryNotice | null) => void;
  setWorkbenchViewState: (viewState: WorkbenchViewState) => void;
};

export function createWorkspaceRecoveryPassState(): WorkspaceRecoveryPassState {
  return {
    promise: null,
  };
}

export function runWorkspaceRecoveryPass(
  state: WorkspaceRecoveryPassState,
  sink: WorkspaceRecoveryStateSink,
  recover: () => Promise<WorkspaceRecoveryResult> = recoverLastOpenWorkspace,
): () => void {
  let isActive = true;

  if (!state.promise) {
    state.promise = recover();
  }

  void state.promise
    .then((recovery) => {
      if (!isActive) {
        return;
      }

      applyWorkspaceRecoveryResult(recovery, sink);
    })
    .catch((error: unknown) => {
      if (!isActive) {
        return;
      }

      clearLastOpenWorkspaceRecord();
      sink.setRecoveryNotice({
        title: "Workspace recovery failed",
        message: `Hobit tried to reopen the last active workspace after the renderer reloaded, but recovery failed: ${errorToMessage(error)} Choose a recent workspace below to continue.`,
      });
      sink.setIsRecoveringWorkspace(false);
    });

  return () => {
    isActive = false;
  };
}

export async function recoverLastOpenWorkspace(): Promise<WorkspaceRecoveryResult> {
  const lastOpenWorkspace = readLastOpenWorkspaceRecord();

  if (!lastOpenWorkspace) {
    return { kind: "none" };
  }

  try {
    const session = await openWorkspaceCommand(lastOpenWorkspace.workspaceId);

    if (!session) {
      throw new Error("Workspace session could not be opened.");
    }

    const workbenchState = await getWorkspaceWorkbenchState(
      lastOpenWorkspace.workspaceId,
    );

    if (!workbenchState) {
      throw new Error("Workbench state could not be loaded.");
    }

    validateRecoveredWorkspace(lastOpenWorkspace, workbenchState);
    saveLastOpenWorkspaceRecord(workbenchState.workspace);

    return {
      kind: "restored",
      viewState: createWorkbenchViewStateFromWorkspaceState(workbenchState),
      workspace: workbenchState.workspace,
    };
  } catch (error) {
    clearLastOpenWorkspaceRecord();

    return {
      kind: "failed",
      notice: {
        title: "Workspace recovery failed",
        message: recoveryFailureMessage(lastOpenWorkspace, error),
      },
    };
  }
}

function applyWorkspaceRecoveryResult(
  recovery: WorkspaceRecoveryResult,
  sink: WorkspaceRecoveryStateSink,
): void {
  if (recovery.kind === "restored") {
    sink.setRecoveryNotice(null);
    sink.setWorkbenchViewState(recovery.viewState);
  } else if (recovery.kind === "failed") {
    sink.setRecoveryNotice(recovery.notice);
  }

  sink.setIsRecoveringWorkspace(false);
}

function validateRecoveredWorkspace(
  record: LastOpenWorkspaceRecord,
  workbenchState: WorkspaceWorkbenchState,
): void {
  if (!workbenchState.workbench) {
    throw new Error("Recovered Workspace did not include a Workbench.");
  }

  if (
    workbenchState.workspace.id !== record.workspaceId ||
    workbenchState.workbench.workspaceId !== record.workspaceId
  ) {
    throw new Error("Recovered Workspace did not match the saved Workspace id.");
  }

  if (
    record.workbenchId !== null &&
    workbenchState.workbench.id !== record.workbenchId
  ) {
    throw new Error("Recovered Workbench did not match the saved Workbench id.");
  }
}

function recoveryFailureMessage(
  record: LastOpenWorkspaceRecord,
  error: unknown,
): string {
  const errorMessage = errorToMessage(error);
  const workspaceName = record.workspaceTitle.trim() || record.workspaceId;

  return `Hobit tried to reopen "${workspaceName}" after the renderer reloaded, but recovery failed: ${errorMessage} Choose a recent workspace below to continue.`;
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Workspace command failed.";
}
