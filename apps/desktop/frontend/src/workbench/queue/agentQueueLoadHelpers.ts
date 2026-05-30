import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import type { AgentQueueTask, AgentQueueTaskRunLinkSummary } from "../../workspace/types";
import { errorToMessage } from "../agentQueueTaskUiModel";
import type { WidgetRenderProps } from "../types";
import { withQueueOrderIndexes } from "./agentQueueOrderingActions";

type LoadQueueTasksInput = Pick<
  WidgetRenderProps,
  | "onCreateAgentQueueTask"
  | "onDeleteAgentQueueTask"
  | "onGetAgentQueueTask"
  | "onListAgentQueueTasks"
  | "onUpdateAgentQueueTask"
> & {
  clearSelectedTask: () => void;
  mergeTaskFoundation: (task: AgentQueueTask) => AgentQueueTask;
  options?: { preserveCurrentOnError?: boolean };
  preferredTaskId?: string | null;
  setAssignmentError: Dispatch<SetStateAction<string | null>>;
  setEditorError: Dispatch<SetStateAction<string | null>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setLoadError: Dispatch<SetStateAction<string | null>>;
  setSaveStateText: Dispatch<SetStateAction<string>>;
  setSelectedDraft: (task: AgentQueueTask) => void;
  setTasks: Dispatch<SetStateAction<AgentQueueTask[]>>;
  setValidationMessage: Dispatch<SetStateAction<string | null>>;
  tasksRef: MutableRefObject<AgentQueueTask[]>;
};

export async function loadAgentQueueTasks({
  clearSelectedTask,
  mergeTaskFoundation,
  onCreateAgentQueueTask,
  onDeleteAgentQueueTask,
  onGetAgentQueueTask,
  onListAgentQueueTasks,
  onUpdateAgentQueueTask,
  options,
  preferredTaskId,
  setAssignmentError,
  setEditorError,
  setIsLoading,
  setLoadError,
  setSaveStateText,
  setSelectedDraft,
  setTasks,
  setValidationMessage,
  tasksRef,
}: LoadQueueTasksInput) {
  if (
    !onCreateAgentQueueTask ||
    !onDeleteAgentQueueTask ||
    !onGetAgentQueueTask ||
    !onListAgentQueueTasks ||
    !onUpdateAgentQueueTask
  ) {
    setTasks([]);
    clearSelectedTask();
    setLoadError("Agent Queue task persistence is not available in this runtime.");
    setIsLoading(false);
    return "Agent Queue task persistence is not available in this runtime.";
  }

  setIsLoading(true);
  setLoadError(null);
  setEditorError(null);
  setAssignmentError(null);
  setValidationMessage(null);

  try {
    const loadedTasks = withQueueOrderIndexes(
      (await onListAgentQueueTasks()).map(mergeTaskFoundation),
    );
    tasksRef.current = loadedTasks;
    setTasks(loadedTasks);

    const preferredExists = loadedTasks.some(
      (task) => task.queueItemId === preferredTaskId,
    );
    const taskIdToSelect = preferredExists
      ? preferredTaskId
      : loadedTasks[0]?.queueItemId;

    if (!taskIdToSelect) {
      clearSelectedTask();
      return null;
    }

    const detail = await onGetAgentQueueTask(taskIdToSelect);

    if (!detail) {
      clearSelectedTask();
      setEditorError("The selected queue task could not be found.");
      return "The selected queue task could not be found.";
    }

    setSelectedDraft(
      loadedTasks.find((task) => task.queueItemId === detail.queueItemId) ??
        detail,
    );
    setSaveStateText("Saved");
    return null;
  } catch (error) {
    if (!options?.preserveCurrentOnError) {
      setTasks([]);
      clearSelectedTask();
      setLoadError(errorToMessage(error, "Unable to load Agent Queue tasks."));
    }
    return errorToMessage(error, "Unable to load Agent Queue tasks.");
  } finally {
    setIsLoading(false);
  }
}

type RefreshQueueRunLinksInput = Pick<
  WidgetRenderProps,
  "onGetAgentQueueTaskLatestRunLink" | "onListAgentQueueTaskRunLinks"
> & {
  options?: { silent?: boolean };
  queueItemId: string | null | undefined;
  setIsLatestRunLinkLoading: Dispatch<SetStateAction<boolean>>;
  setLatestRunLink: Dispatch<
    SetStateAction<AgentQueueTaskRunLinkSummary | null>
  >;
  setLatestRunLinkError: Dispatch<SetStateAction<string | null>>;
  setRunHistoryLinks: Dispatch<SetStateAction<AgentQueueTaskRunLinkSummary[]>>;
};

export async function refreshAgentQueueRunLinks({
  onGetAgentQueueTaskLatestRunLink,
  onListAgentQueueTaskRunLinks,
  options,
  queueItemId,
  setIsLatestRunLinkLoading,
  setLatestRunLink,
  setLatestRunLinkError,
  setRunHistoryLinks,
}: RefreshQueueRunLinksInput) {
  if (!queueItemId || (!onListAgentQueueTaskRunLinks && !onGetAgentQueueTaskLatestRunLink)) {
    setLatestRunLink(null);
    setRunHistoryLinks([]);
    setLatestRunLinkError(null);
    setIsLatestRunLinkLoading(false);
    return;
  }

  if (!options?.silent) {
    setIsLatestRunLinkLoading(true);
  }
  setLatestRunLinkError(null);

  try {
    if (onListAgentQueueTaskRunLinks) {
      const links = await onListAgentQueueTaskRunLinks(queueItemId);
      setRunHistoryLinks(links);
      setLatestRunLink(links[0] ?? null);
    } else if (onGetAgentQueueTaskLatestRunLink) {
      const link = await onGetAgentQueueTaskLatestRunLink(queueItemId);
      setLatestRunLink(link);
      setRunHistoryLinks(link ? [link] : []);
    }
  } catch (error) {
    setLatestRunLink(null);
    setRunHistoryLinks([]);
    setLatestRunLinkError(
      errorToMessage(error, "Unable to load Queue run metadata."),
    );
  } finally {
    if (!options?.silent) {
      setIsLatestRunLinkLoading(false);
    }
  }
}
