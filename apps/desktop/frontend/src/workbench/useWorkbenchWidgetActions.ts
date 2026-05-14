import { useState } from "react";
import {
  addWidgetInstanceToWorkbench,
  cancelCodexDirectWorkRun,
  getAgentExecutorDiffSummary,
  getAgentExecutorRunDetail,
  getAgentQueueSnapshot,
  getGitRepositoryStatus,
  listAgentExecutorRuns,
  listenToDirectWorkStreamEvents,
  listWidgetLogs,
  runCodexDirectWork,
  runDirectWorkValidation,
  startCodexDirectWorkStream,
  runTerminalCommand,
  updateWidgetInstanceLayout,
  updateWidgetInstanceState,
} from "../workspace/workspaceApi";
import type {
  AgentExecutorDiffSummary,
  AgentQueueSnapshot,
  AgentExecutorRunDetail,
  AgentExecutorRunHistory,
  CancelCodexDirectWorkRunResponse,
  DirectWorkStreamEvent,
  GitRepositoryStatus,
  RunCodexDirectWorkRequest,
  RunCodexDirectWorkResponse,
  RunDirectWorkValidationRequest,
  RunDirectWorkValidationResponse,
  StartCodexDirectWorkStreamResponse,
  RunTerminalCommandRequest,
  RunTerminalCommandResponse,
  WorkspaceWorkbenchState,
} from "../workspace/types";
import type { WidgetCatalogTemplate } from "./catalogTemplates";
import { directWorkResultFromStreamEvent } from "./directWorkStreamActivity";
import type {
  WidgetInstanceId,
  WidgetLogEntry,
  WidgetLayout,
  WidgetState,
  WorkbenchViewState,
} from "./types";
import type { CurrentSessionActivityEvents } from "./useCurrentSessionActivity";
import { createWorkbenchViewStateFromWorkspaceState } from "./viewState";
import { removeWidgetInstanceFromWorkbenchView } from "./widgetDeletionAction";
import { widgetLogEntryFromApi } from "./widgetLogEntryMapping";

type UseWorkbenchWidgetActionsOptions = {
  currentSessionActivity?: CurrentSessionActivityEvents;
  onViewStateChange: (viewState: WorkbenchViewState) => void;
  viewState: WorkbenchViewState;
};

export type WorkbenchWidgetActions = {
  addWidgetTemplate: (template: WidgetCatalogTemplate) => Promise<boolean>;
  getGitRepositoryStatus: (
    widgetInstanceId: WidgetInstanceId,
    repositoryRoot: string,
  ) => Promise<GitRepositoryStatus | null>;
  getAgentQueueSnapshot: () => Promise<AgentQueueSnapshot | null>;
  listAgentExecutorRuns: (
    widgetInstanceId: WidgetInstanceId,
    limit?: number,
  ) => Promise<AgentExecutorRunHistory | null>;
  getAgentExecutorRunDetail: (
    widgetInstanceId: WidgetInstanceId,
    runId: string,
  ) => Promise<AgentExecutorRunDetail | null>;
  getAgentExecutorDiffSummary: (
    widgetInstanceId: WidgetInstanceId,
    repositoryRoot: string,
  ) => Promise<AgentExecutorDiffSummary | null>;
  listWidgetLogs: (widgetInstanceId: WidgetInstanceId) => Promise<WidgetLogEntry[]>;
  logRefreshTokens: Partial<Record<WidgetInstanceId, number>>;
  removeWidgetInstance: (widgetInstanceId: WidgetInstanceId) => Promise<void>;
  runCodexDirectWork: (
    widgetInstanceId: WidgetInstanceId,
    request: CodexDirectWorkRunRequest,
  ) => Promise<RunCodexDirectWorkResponse | null>;
  runDirectWorkValidation: (
    widgetInstanceId: WidgetInstanceId,
    request: DirectWorkValidationRunRequest,
  ) => Promise<RunDirectWorkValidationResponse | null>;
  cancelCodexDirectWorkRun: (
    widgetInstanceId: WidgetInstanceId,
    runId: string,
  ) => Promise<CancelCodexDirectWorkRunResponse | null>;
  startCodexDirectWorkStream: (
    widgetInstanceId: WidgetInstanceId,
    request: CodexDirectWorkRunRequest,
    onEvent: (event: DirectWorkStreamEvent) => void,
  ) => Promise<CodexDirectWorkStreamSession | null>;
  runTerminalCommand: (
    widgetInstanceId: WidgetInstanceId,
    command: TerminalCommandRunRequest,
  ) => Promise<RunTerminalCommandResponse | null>;
  updateWidgetLayout: (widgetInstanceId: WidgetInstanceId, layout: WidgetLayout) => Promise<void>;
  updateWidgetState: (widgetInstanceId: WidgetInstanceId, state: WidgetState) => Promise<void>;
};

export type WorkbenchWidgetInstanceActions = Pick<
  WorkbenchWidgetActions,
  | "listWidgetLogs"
  | "logRefreshTokens"
  | "removeWidgetInstance"
  | "listAgentExecutorRuns"
  | "getAgentExecutorRunDetail"
  | "getAgentExecutorDiffSummary"
  | "getAgentQueueSnapshot"
  | "getGitRepositoryStatus"
  | "runCodexDirectWork"
  | "runDirectWorkValidation"
  | "cancelCodexDirectWorkRun"
  | "startCodexDirectWorkStream"
  | "runTerminalCommand"
  | "updateWidgetLayout"
  | "updateWidgetState"
>;

type TerminalCommandRunRequest = Omit<
  RunTerminalCommandRequest,
  "workspaceId" | "workbenchId" | "widgetInstanceId"
>;

type CodexDirectWorkRunRequest = Omit<
  RunCodexDirectWorkRequest,
  "workspaceId" | "workbenchId" | "widgetInstanceId"
>;

type DirectWorkValidationRunRequest = Omit<
  RunDirectWorkValidationRequest,
  "workspaceId" | "workbenchId" | "widgetInstanceId"
>;

type CodexDirectWorkStreamSession = StartCodexDirectWorkStreamResponse & { stopListening: () => void };

export function useWorkbenchWidgetActions({
  currentSessionActivity,
  onViewStateChange,
  viewState,
}: UseWorkbenchWidgetActionsOptions): WorkbenchWidgetActions {
  const [logRefreshTokens, setLogRefreshTokens] = useState<
    Partial<Record<WidgetInstanceId, number>>
  >({});

  function applyWorkbenchState(workbenchState: WorkspaceWorkbenchState) {
    onViewStateChange(
      createWorkbenchViewStateFromWorkspaceState(workbenchState),
    );
  }

  function bumpWidgetLogRefreshToken(widgetInstanceId: WidgetInstanceId) {
    setLogRefreshTokens((currentTokens) => ({
      ...currentTokens,
      [widgetInstanceId]: (currentTokens[widgetInstanceId] ?? 0) + 1,
    }));
  }

  async function addWidgetTemplate(template: WidgetCatalogTemplate) {
    if (template.status !== "available" || !viewState.workbench.id) {
      return false;
    }

    try {
      const workbenchState = await addWidgetInstanceToWorkbench({
        workspaceId: viewState.workspace.id,
        workbenchId: viewState.workbench.id,
        definitionId: template.futureWidgetDefinitionId ?? template.id,
        title: template.title,
        category: template.category,
      });

      if (!workbenchState) {
        return false;
      }

      applyWorkbenchState(workbenchState);
      return true;
    } catch (error) {
      console.error("Failed to add widget instance.", error);
      return false;
    }
  }

  async function updateWidgetState(
    widgetInstanceId: WidgetInstanceId,
    state: WidgetState,
  ) {
    if (!viewState.workbench.id) {
      throw new Error("A workbench must be open to update widget state.");
    }

    const workbenchState = await updateWidgetInstanceState({
      workspaceId: viewState.workspace.id,
      workbenchId: viewState.workbench.id,
      widgetInstanceId,
      state: JSON.stringify(state),
    });

    if (!workbenchState) {
      throw new Error("Widget state could not be updated.");
    }

    applyWorkbenchState(workbenchState);
    bumpWidgetLogRefreshToken(widgetInstanceId);
  }

  async function updateWidgetLayout(
    widgetInstanceId: WidgetInstanceId,
    layout: WidgetLayout,
  ) {
    if (!viewState.workbench.id) {
      throw new Error("A workbench must be open to update widget layout.");
    }

    const widget = viewState.widgets.find(
      (candidate) => candidate.id === widgetInstanceId,
    );

    if (!widget) {
      throw new Error("Widget layout could not be updated.");
    }

    const workbenchState = await updateWidgetInstanceLayout({
      workspaceId: viewState.workspace.id,
      workbenchId: viewState.workbench.id,
      widgetInstanceId,
      layout: {
        layoutMode: persistedLayoutMode(layout.mode),
        dockX: layout.x,
        dockY: layout.y,
        dockWidth: layout.width,
        dockHeight: layout.height,
        popoutX: layout.popout?.x ?? null,
        popoutY: layout.popout?.y ?? null,
        popoutWidth: layout.popout?.width ?? null,
        popoutHeight: layout.popout?.height ?? null,
        alwaysOnTop:
          layout.mode === "popped-out"
            ? (layout.popout?.alwaysOnTop ?? false)
            : false,
        isVisible: widget.visible,
      },
    });

    if (!workbenchState) {
      throw new Error("Widget layout could not be updated.");
    }

    applyWorkbenchState(workbenchState);
    bumpWidgetLogRefreshToken(widgetInstanceId);
  }

  async function removeWidgetInstance(widgetInstanceId: WidgetInstanceId) {
    const workbenchState = await removeWidgetInstanceFromWorkbenchView(
      viewState,
      widgetInstanceId,
    );
    applyWorkbenchState(workbenchState);
  }

  async function loadWidgetLogs(widgetInstanceId: WidgetInstanceId) {
    if (!viewState.workbench.id) {
      throw new Error("A workbench must be open to load widget logs.");
    }

    const widget = viewState.widgets.find(
      (candidate) => candidate.id === widgetInstanceId,
    );

    if (!widget) {
      throw new Error("Widget logs could not be loaded.");
    }

    const logs = await listWidgetLogs({
      workspaceId: viewState.workspace.id,
      workbenchId: viewState.workbench.id,
      widgetInstanceId,
      limit: 100,
    });

    return logs.map(widgetLogEntryFromApi);
  }

  async function loadAgentQueueSnapshot() {
    if (!viewState.workbench.id) {
      throw new Error("A workbench must be open to read Agent Queue review items.");
    }

    return getAgentQueueSnapshot({
      workspaceId: viewState.workspace.id,
      workbenchId: viewState.workbench.id,
    });
  }

  async function loadAgentExecutorRuns(
    widgetInstanceId: WidgetInstanceId,
    limit = 20,
  ) {
    if (!viewState.workbench.id) {
      throw new Error("A workbench must be open to read Agent Executor history.");
    }

    const widget = viewState.widgets.find(
      (candidate) => candidate.id === widgetInstanceId,
    );

    if (!widget) {
      throw new Error("Agent Executor history could not be read for this widget.");
    }

    return listAgentExecutorRuns({
      workspaceId: viewState.workspace.id,
      workbenchId: viewState.workbench.id,
      widgetInstanceId,
      limit,
    });
  }

  async function loadAgentExecutorRunDetail(
    widgetInstanceId: WidgetInstanceId,
    runId: string,
  ) {
    if (!viewState.workbench.id) {
      throw new Error("A workbench must be open to read Agent Executor run detail.");
    }

    const widget = viewState.widgets.find(
      (candidate) => candidate.id === widgetInstanceId,
    );

    if (!widget) {
      throw new Error("Agent Executor run detail could not be read for this widget.");
    }

    return getAgentExecutorRunDetail({
      workspaceId: viewState.workspace.id,
      workbenchId: viewState.workbench.id,
      widgetInstanceId,
      runId,
    });
  }

  async function loadAgentExecutorDiffSummary(
    widgetInstanceId: WidgetInstanceId,
    repositoryRoot: string,
  ) {
    if (!viewState.workbench.id) {
      throw new Error("A workbench must be open to read Agent Executor diff summary.");
    }

    const widget = viewState.widgets.find(
      (candidate) => candidate.id === widgetInstanceId,
    );

    if (!widget) {
      throw new Error("Agent Executor diff summary could not be read for this widget.");
    }

    return getAgentExecutorDiffSummary({
      workspaceId: viewState.workspace.id,
      workbenchId: viewState.workbench.id,
      widgetInstanceId,
      repoRoot: repositoryRoot,
      includePatchPreview: true,
    });
  }

  async function loadGitRepositoryStatus(
    widgetInstanceId: WidgetInstanceId,
    repositoryRoot: string,
  ) {
    if (!viewState.workbench.id) {
      throw new Error("A workbench must be open to refresh Git status.");
    }

    const widget = viewState.widgets.find(
      (candidate) => candidate.id === widgetInstanceId,
    );

    if (!widget) {
      throw new Error("Git status could not be refreshed for this widget.");
    }

    return getGitRepositoryStatus({
      workspaceId: viewState.workspace.id,
      workbenchId: viewState.workbench.id,
      widgetInstanceId,
      repositoryRoot,
    });
  }

  async function runTerminalWidgetCommand(
    widgetInstanceId: WidgetInstanceId,
    command: TerminalCommandRunRequest,
  ) {
    if (!viewState.workbench.id) {
      throw new Error("A workbench must be open to run a Terminal command.");
    }

    const widget = viewState.widgets.find(
      (candidate) => candidate.id === widgetInstanceId,
    );

    if (!widget) {
      throw new Error("Terminal command could not be run for this widget.");
    }

    currentSessionActivity?.markTerminalRunStarted(widgetInstanceId);

    try {
      const response = await runTerminalCommand({
        workspaceId: viewState.workspace.id,
        workbenchId: viewState.workbench.id,
        widgetInstanceId,
        ...command,
      });

      if (response) {
        bumpWidgetLogRefreshToken(widgetInstanceId);
      }

      currentSessionActivity?.markTerminalRunFinished(
        widgetInstanceId,
        response,
      );
      return response;
    } catch (error) {
      currentSessionActivity?.markTerminalRunFailed(widgetInstanceId, error);
      throw error;
    }
  }

  async function runCodexDirectWorkForWidget(
    widgetInstanceId: WidgetInstanceId,
    request: CodexDirectWorkRunRequest,
  ) {
    if (!viewState.workbench.id) {
      throw new Error("A workbench must be open to run Codex Direct Work.");
    }

    const widget = viewState.widgets.find(
      (candidate) => candidate.id === widgetInstanceId,
    );

    if (!widget) {
      throw new Error("Codex Direct Work could not be run for this widget.");
    }

    currentSessionActivity?.markDirectWorkRunStarted(widgetInstanceId);

    try {
      const response = await runCodexDirectWork({
        workspaceId: viewState.workspace.id,
        workbenchId: viewState.workbench.id,
        widgetInstanceId,
        ...request,
      });

      if (response) {
        bumpWidgetLogRefreshToken(widgetInstanceId);
      }

      currentSessionActivity?.markDirectWorkRunFinished(
        widgetInstanceId,
        response,
      );
      return response;
    } catch (error) {
      currentSessionActivity?.markDirectWorkRunFailed(widgetInstanceId, error);
      throw error;
    }
  }

  async function runDirectWorkValidationForWidget(
    widgetInstanceId: WidgetInstanceId,
    request: DirectWorkValidationRunRequest,
  ) {
    if (!viewState.workbench.id) {
      throw new Error("A workbench must be open to run Direct Work validation.");
    }

    const widget = viewState.widgets.find(
      (candidate) => candidate.id === widgetInstanceId,
    );

    if (!widget) {
      throw new Error("Direct Work validation could not be run for this widget.");
    }

    const response = await runDirectWorkValidation({
      workspaceId: viewState.workspace.id,
      workbenchId: viewState.workbench.id,
      widgetInstanceId,
      ...request,
    });

    if (response) {
      bumpWidgetLogRefreshToken(widgetInstanceId);
    }

    return response;
  }

  async function cancelCodexDirectWorkRunForWidget(
    widgetInstanceId: WidgetInstanceId,
    runId: string,
  ) {
    if (!viewState.workbench.id) {
      throw new Error("A workbench must be open to stop Codex Direct Work.");
    }

    const widget = viewState.widgets.find(
      (candidate) => candidate.id === widgetInstanceId,
    );

    if (!widget) {
      throw new Error("Codex Direct Work could not be stopped for this widget.");
    }

    const response = await cancelCodexDirectWorkRun({
      workspaceId: viewState.workspace.id,
      workbenchId: viewState.workbench.id,
      widgetInstanceId,
      runId,
    });

    if (response) {
      bumpWidgetLogRefreshToken(widgetInstanceId);
    }

    return response;
  }

  async function startCodexDirectWorkStreamForWidget(
    widgetInstanceId: WidgetInstanceId,
    request: CodexDirectWorkRunRequest,
    onEvent: (event: DirectWorkStreamEvent) => void,
  ): Promise<CodexDirectWorkStreamSession | null> {
    if (!viewState.workbench.id) {
      throw new Error("A workbench must be open to run Codex Direct Work.");
    }

    const widget = viewState.widgets.find(
      (candidate) => candidate.id === widgetInstanceId,
    );

    if (!widget) {
      throw new Error("Codex Direct Work could not be run for this widget.");
    }

    const workspaceId = viewState.workspace.id;
    const workbenchId = viewState.workbench.id;
    let activeRunId: string | null = null;
    const queuedEvents: DirectWorkStreamEvent[] = [];
    let finalEventSeen = false;

    const unsubscribe = await listenToDirectWorkStreamEvents((event) => {
      if (
        event.workspaceId !== workspaceId ||
        event.workbenchId !== workbenchId ||
        event.widgetInstanceId !== widgetInstanceId
      ) {
        return;
      }

      if (!activeRunId) {
        queuedEvents.push(event);
        return;
      }

      if (event.runId !== activeRunId) {
        return;
      }

      onEvent(event);

      if (event.isFinal) {
        finalEventSeen = true;
        bumpWidgetLogRefreshToken(widgetInstanceId);
        currentSessionActivity?.markDirectWorkRunFinished(
          widgetInstanceId,
          directWorkResultFromStreamEvent(event),
        );
        unsubscribe();
      }
    });

    currentSessionActivity?.markDirectWorkRunStarted(widgetInstanceId);

    try {
      const response = await startCodexDirectWorkStream({
        workspaceId,
        workbenchId,
        widgetInstanceId,
        ...request,
      });

      if (!response) {
        unsubscribe();
        currentSessionActivity?.markDirectWorkRunFinished(
          widgetInstanceId,
          null,
        );
        return null;
      }

      activeRunId = response.runId;
      queuedEvents
        .filter((event) => event.runId === activeRunId)
        .forEach((event) => {
          onEvent(event);

          if (event.isFinal) {
            finalEventSeen = true;
            bumpWidgetLogRefreshToken(widgetInstanceId);
            currentSessionActivity?.markDirectWorkRunFinished(
              widgetInstanceId,
              directWorkResultFromStreamEvent(event),
            );
            unsubscribe();
          }
        });

      return {
        ...response,
        stopListening: () => {
          unsubscribe();
          if (!finalEventSeen) {
            bumpWidgetLogRefreshToken(widgetInstanceId);
          }
        },
      };
    } catch (error) {
      unsubscribe();
      currentSessionActivity?.markDirectWorkRunFailed(widgetInstanceId, error);
      throw error;
    }
  }

  return {
    addWidgetTemplate,
    getAgentQueueSnapshot: loadAgentQueueSnapshot,
    listAgentExecutorRuns: loadAgentExecutorRuns,
    getAgentExecutorRunDetail: loadAgentExecutorRunDetail,
    getAgentExecutorDiffSummary: loadAgentExecutorDiffSummary,
    getGitRepositoryStatus: loadGitRepositoryStatus,
    listWidgetLogs: loadWidgetLogs,
    logRefreshTokens,
    removeWidgetInstance,
    runCodexDirectWork: runCodexDirectWorkForWidget,
    runDirectWorkValidation: runDirectWorkValidationForWidget,
    cancelCodexDirectWorkRun: cancelCodexDirectWorkRunForWidget,
    startCodexDirectWorkStream: startCodexDirectWorkStreamForWidget,
    runTerminalCommand: runTerminalWidgetCommand,
    updateWidgetLayout,
    updateWidgetState,
  };
}

function persistedLayoutMode(mode: WidgetLayout["mode"]) {
  return mode === "popped-out" ? "popped_out" : mode;
}
