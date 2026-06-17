import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import type {
  AgentQueueTask,
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
} from "../../workspace/types";
import {
  errorToMessage,
  normalizeItemType,
  normalizeQueueTag,
  normalizeTaskExecutionPolicy,
  normalizeTaskStatus,
  normalizeValidationStatus,
  type TaskDraft,
} from "../agentQueueTaskUiModel";
import type { WidgetRenderProps } from "../types";
import type { AgentQueueRunSettingsUpdateResult } from "./agentQueueControllerTypes";

type UseAgentQueueRunSettingsInput = Pick<
  WidgetRenderProps,
  "onUpdateAgentQueueTask"
> & {
  applyUpdatedTask: (
    task: AgentQueueTask,
    options?: { select?: boolean },
  ) => void;
  approvalPolicy: DirectWorkApprovalPolicy;
  codexExecutableDraft: string;
  draft: TaskDraft;
  isDirty: boolean;
  isEditing: boolean;
  repoRootDraft: string;
  sandbox: DirectWorkSandbox;
  selectedTask: AgentQueueTask | null;
  setApprovalPolicy: Dispatch<SetStateAction<DirectWorkApprovalPolicy>>;
  setCodexExecutableDraft: Dispatch<SetStateAction<string>>;
  setDeleteError: Dispatch<SetStateAction<string | null>>;
  setDeleteMessage: Dispatch<SetStateAction<string | null>>;
  setRepoRootDraft: Dispatch<SetStateAction<string>>;
  setSandbox: Dispatch<SetStateAction<DirectWorkSandbox>>;
  setStartError: Dispatch<SetStateAction<string | null>>;
  tasksRef: MutableRefObject<AgentQueueTask[]>;
};

export function useAgentQueueRunSettings({
  applyUpdatedTask,
  approvalPolicy,
  codexExecutableDraft,
  draft,
  isDirty,
  isEditing,
  onUpdateAgentQueueTask,
  repoRootDraft,
  sandbox,
  selectedTask,
  setApprovalPolicy,
  setCodexExecutableDraft,
  setDeleteError,
  setDeleteMessage,
  setRepoRootDraft,
  setSandbox,
  setStartError,
  tasksRef,
}: UseAgentQueueRunSettingsInput) {
  const selectedTaskExecutionWorkspace = selectedTask
    ? (isEditing || isDirty ? draft.executionWorkspace : selectedTask.executionWorkspace ?? "")
    : repoRootDraft;
  const selectedTaskCodexExecutable = selectedTask
    ? (isEditing || isDirty ? draft.codexExecutable : selectedTask.codexExecutable ?? "")
    : codexExecutableDraft;
  const selectedTaskSandbox = selectedTask
    ? (isEditing || isDirty ? draft.sandbox : selectedTask.sandbox ?? "")
    : sandbox;
  const selectedTaskApprovalPolicy = selectedTask
    ? (isEditing || isDirty ? draft.approvalPolicy : selectedTask.approvalPolicy ?? "")
    : approvalPolicy;
  const repoRoot = selectedTaskExecutionWorkspace.trim();
  const codexExecutable = selectedTaskCodexExecutable.trim();
  const selectedTaskSandboxForRun =
    selectedTaskSandbox === "read_only" ||
    selectedTaskSandbox === "workspace_write" ||
    selectedTaskSandbox === "danger_full_access"
      ? selectedTaskSandbox
      : sandbox;
  const selectedTaskApprovalPolicyForRun =
    selectedTaskApprovalPolicy === "never" ||
    selectedTaskApprovalPolicy === "on_request" ||
    selectedTaskApprovalPolicy === "untrusted"
      ? selectedTaskApprovalPolicy
      : approvalPolicy;
  const hasUnsavedTaskSettings = Boolean(
    selectedTask &&
      (draft.executionWorkspace !== (selectedTask.executionWorkspace ?? "") ||
        draft.codexExecutable !== (selectedTask.codexExecutable ?? "") ||
        draft.sandbox !== (selectedTask.sandbox ?? "") ||
        draft.approvalPolicy !== (selectedTask.approvalPolicy ?? "")),
  );

  function updateSelectedTaskExecutionWorkspace(value: string) {
    if (selectedTask) {
      updateSelectedTaskRunSettings({ executionWorkspace: value });
    } else {
      setRepoRootDraft(value);
    }
    setStartError(null);
    setDeleteError(null);
    setDeleteMessage(null);
  }

  function updateSelectedTaskCodexExecutable(value: string) {
    if (selectedTask) {
      updateSelectedTaskRunSettings({ codexExecutable: value });
    } else {
      setCodexExecutableDraft(value);
    }
    setStartError(null);
  }

  function updateSelectedTaskSandbox(value: DirectWorkSandbox) {
    if (selectedTask) {
      updateSelectedTaskRunSettings({ sandbox: value });
    } else {
      setSandbox(value);
    }
    setStartError(null);
  }

  function updateSelectedTaskApprovalPolicy(value: DirectWorkApprovalPolicy) {
    if (selectedTask) {
      updateSelectedTaskRunSettings({ approvalPolicy: value });
    } else {
      setApprovalPolicy(value);
    }
    setStartError(null);
  }

  function updateSelectedTaskRunSettings(
    nextSettings: Partial<Pick<
      AgentQueueTask,
      "executionWorkspace" | "codexExecutable" | "sandbox" | "approvalPolicy"
    >>,
  ) {
    void persistSelectedTaskRunSettings(nextSettings, { optimistic: true });
  }

  async function saveSelectedTaskCodexExecutable(
    codexExecutableValue: string,
  ): Promise<AgentQueueRunSettingsUpdateResult> {
    const codexExecutableSetting = codexExecutableValue.trim();

    if (!codexExecutableSetting) {
      return {
        message: "Enter a Codex executable before saving.",
        ok: false,
      };
    }

    return persistSelectedTaskRunSettings(
      { codexExecutable: codexExecutableSetting },
      { optimistic: false },
    );
  }

  async function persistSelectedTaskRunSettings(
    nextSettings: Partial<Pick<
      AgentQueueTask,
      "executionWorkspace" | "codexExecutable" | "sandbox" | "approvalPolicy"
    >>,
    options: { optimistic: boolean },
  ): Promise<AgentQueueRunSettingsUpdateResult> {
    if (!selectedTask) {
      return {
        message: "Select a Queue task before updating task settings.",
        ok: false,
      };
    }

    const currentSelectedTask =
      tasksRef.current.find((task) => task.queueItemId === selectedTask.queueItemId) ??
      selectedTask;
    const updatedTask: AgentQueueTask = {
      ...currentSelectedTask,
      ...nextSettings,
    };

    if (options.optimistic) {
      applyUpdatedTask(updatedTask, { select: true });
    }

    if (!onUpdateAgentQueueTask) {
      return {
        message: "Queue task updates are unavailable in this runtime.",
        ok: false,
      };
    }

    try {
      const persistedTask = await onUpdateAgentQueueTask({
        approvalPolicy: updatedTask.approvalPolicy ?? null,
        codexExecutable: updatedTask.codexExecutable ?? null,
        description: updatedTask.description,
        executionPolicy: normalizeTaskExecutionPolicy(updatedTask.executionPolicy),
        executionWorkspace: updatedTask.executionWorkspace ?? null,
        itemType: normalizeItemType(updatedTask.itemType),
        priority: updatedTask.priority,
        prompt: updatedTask.prompt,
        queueItemId: updatedTask.queueItemId,
        queueTagId: normalizeQueueTag(updatedTask).queueTagId,
        queueTagName: normalizeQueueTag(updatedTask).queueTagName,
        sandbox: updatedTask.sandbox ?? null,
        status: normalizeTaskStatus(updatedTask.status),
        title: updatedTask.title,
        validationStatus: normalizeValidationStatus(updatedTask.validationStatus),
      });

      if (!persistedTask) {
        return {
          message: "The selected Queue task could not be found.",
          ok: false,
        };
      }

      applyUpdatedTask(persistedTask, { select: true });
      return {
        ok: true,
        task: persistedTask,
      };
    } catch (error) {
      const message = errorToMessage(
        error,
        "Unable to save task run settings.",
      );

      setStartError(message);
      return {
        message,
        ok: false,
      };
    }
  }

  return {
    codexExecutable,
    hasUnsavedTaskSettings,
    repoRoot,
    selectedTaskApprovalPolicy,
    selectedTaskApprovalPolicyForRun,
    selectedTaskCodexExecutable,
    selectedTaskExecutionWorkspace,
    selectedTaskSandbox,
    selectedTaskSandboxForRun,
    updateSelectedTaskApprovalPolicy,
    updateSelectedTaskCodexExecutable,
    updateSelectedTaskExecutionWorkspace,
    updateSelectedTaskSandbox,
    saveSelectedTaskCodexExecutable,
  };
}
