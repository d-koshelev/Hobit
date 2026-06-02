import {
  cancelCodexDirectWorkRun,
  forceKillCodexDirectWorkRun,
  getAgentExecutorDiffSummary,
  getAgentExecutorRunDetail,
  listenToDirectWorkStreamEvents,
  listAgentExecutorRuns,
  runCodexDirectWork,
  runDirectWorkValidation,
} from "../workspace/workspaceApi";
import type {
  AgentExecutorDiffSummary,
  AgentExecutorRunDetail,
  AgentExecutorRunHistory,
  CancelCodexDirectWorkRunResponse,
  DirectWorkStreamEvent,
  ForceKillCodexDirectWorkRunResponse,
  RunCodexDirectWorkResponse,
  RunDirectWorkValidationRequest,
  RunDirectWorkValidationResponse,
} from "../workspace/types";
import {
  attachDirectWorkStreamSession,
  startDirectWorkStreamSession,
  type CodexDirectWorkRunRequest,
  type CodexDirectWorkStreamSession,
} from "./directWorkStreamSessions";
import type { WidgetInstanceId, WorkbenchViewState } from "./types";
import type { CurrentSessionActivityEvents } from "./useCurrentSessionActivity";
import {
  requireOpenWorkbench,
  requireWidget,
  type WidgetLogRefreshTokenBumper,
} from "./workbenchWidgetActionContext";

export type DirectWorkValidationRunRequest = Omit<
  RunDirectWorkValidationRequest,
  "workspaceId" | "workbenchId" | "widgetInstanceId"
>;

export type AgentExecutorWidgetActions = {
  attachToCodexDirectWorkStream: (
    widgetInstanceId: WidgetInstanceId,
    runId: string,
    onEvent: (event: DirectWorkStreamEvent) => void,
  ) => Promise<CodexDirectWorkStreamSession | null>;
  cancelCodexDirectWorkRun: (
    widgetInstanceId: WidgetInstanceId,
    runId: string,
  ) => Promise<CancelCodexDirectWorkRunResponse | null>;
  forceKillCodexDirectWorkRun: (
    widgetInstanceId: WidgetInstanceId,
    runId: string,
  ) => Promise<ForceKillCodexDirectWorkRunResponse | null>;
  getAgentExecutorDiffSummary: (
    widgetInstanceId: WidgetInstanceId,
    repositoryRoot: string,
  ) => Promise<AgentExecutorDiffSummary | null>;
  getAgentExecutorRunDetail: (
    widgetInstanceId: WidgetInstanceId,
    runId: string,
  ) => Promise<AgentExecutorRunDetail | null>;
  listAgentExecutorRuns: (
    widgetInstanceId: WidgetInstanceId,
    limit?: number,
  ) => Promise<AgentExecutorRunHistory | null>;
  listenToDirectWorkStreamEvents: (
    onEvent: (event: DirectWorkStreamEvent) => void,
  ) => Promise<() => void>;
  runCodexDirectWork: (
    widgetInstanceId: WidgetInstanceId,
    request: CodexDirectWorkRunRequest,
  ) => Promise<RunCodexDirectWorkResponse | null>;
  runDirectWorkValidation: (
    widgetInstanceId: WidgetInstanceId,
    request: DirectWorkValidationRunRequest,
  ) => Promise<RunDirectWorkValidationResponse | null>;
  startCodexDirectWorkStream: (
    widgetInstanceId: WidgetInstanceId,
    request: CodexDirectWorkRunRequest,
    onEvent: (event: DirectWorkStreamEvent) => void,
  ) => Promise<CodexDirectWorkStreamSession | null>;
};

type AgentExecutorWidgetActionOptions = {
  bumpWidgetLogRefreshToken: WidgetLogRefreshTokenBumper;
  currentSessionActivity?: CurrentSessionActivityEvents;
  viewState: WorkbenchViewState;
};

export function createAgentExecutorWidgetActions({
  bumpWidgetLogRefreshToken,
  currentSessionActivity,
  viewState,
}: AgentExecutorWidgetActionOptions): AgentExecutorWidgetActions {
  async function loadAgentExecutorRuns(
    widgetInstanceId: WidgetInstanceId,
    limit = 20,
  ) {
    const workbenchId = requireOpenWorkbench(
      viewState,
      "read Agent Executor history",
    );
    requireWidget(
      viewState,
      widgetInstanceId,
      "Agent Executor history could not be read for this widget.",
    );

    return listAgentExecutorRuns({
      workspaceId: viewState.workspace.id,
      workbenchId,
      widgetInstanceId,
      limit,
    });
  }

  async function loadAgentExecutorRunDetail(
    widgetInstanceId: WidgetInstanceId,
    runId: string,
  ) {
    const workbenchId = requireOpenWorkbench(
      viewState,
      "read Agent Executor run detail",
    );
    requireWidget(
      viewState,
      widgetInstanceId,
      "Agent Executor run detail could not be read for this widget.",
    );

    return getAgentExecutorRunDetail({
      workspaceId: viewState.workspace.id,
      workbenchId,
      widgetInstanceId,
      runId,
    });
  }

  async function loadAgentExecutorDiffSummary(
    widgetInstanceId: WidgetInstanceId,
    repositoryRoot: string,
  ) {
    const workbenchId = requireOpenWorkbench(
      viewState,
      "read Agent Executor diff summary",
    );
    requireWidget(
      viewState,
      widgetInstanceId,
      "Agent Executor diff summary could not be read for this widget.",
    );

    return getAgentExecutorDiffSummary({
      workspaceId: viewState.workspace.id,
      workbenchId,
      widgetInstanceId,
      repoRoot: repositoryRoot,
      includePatchPreview: true,
    });
  }

  async function runCodexDirectWorkForWidget(
    widgetInstanceId: WidgetInstanceId,
    request: CodexDirectWorkRunRequest,
  ) {
    const workbenchId = requireOpenWorkbench(
      viewState,
      "run Codex Direct Work",
    );
    requireWidget(
      viewState,
      widgetInstanceId,
      "Codex Direct Work could not be run for this widget.",
    );

    currentSessionActivity?.markDirectWorkRunStarted(widgetInstanceId);

    try {
      const response = await runCodexDirectWork({
        workspaceId: viewState.workspace.id,
        workbenchId,
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
    const workbenchId = requireOpenWorkbench(
      viewState,
      "run Direct Work validation",
    );
    requireWidget(
      viewState,
      widgetInstanceId,
      "Direct Work validation could not be run for this widget.",
    );

    const response = await runDirectWorkValidation({
      workspaceId: viewState.workspace.id,
      workbenchId,
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
    const workbenchId = requireOpenWorkbench(
      viewState,
      "stop Codex Direct Work",
    );
    requireWidget(
      viewState,
      widgetInstanceId,
      "Codex Direct Work could not be stopped for this widget.",
    );

    const response = await cancelCodexDirectWorkRun({
      workspaceId: viewState.workspace.id,
      workbenchId,
      widgetInstanceId,
      runId,
    });

    if (response) {
      bumpWidgetLogRefreshToken(widgetInstanceId);
    }

    return response;
  }

  async function forceKillCodexDirectWorkRunForWidget(
    widgetInstanceId: WidgetInstanceId,
    runId: string,
  ) {
    const workbenchId = requireOpenWorkbench(
      viewState,
      "force kill Codex Direct Work",
    );
    requireWidget(
      viewState,
      widgetInstanceId,
      "Codex Direct Work could not be force-killed for this widget.",
    );

    const response = await forceKillCodexDirectWorkRun({
      workspaceId: viewState.workspace.id,
      workbenchId,
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
    const workbenchId = requireOpenWorkbench(
      viewState,
      "run Codex Direct Work",
    );
    requireWidget(
      viewState,
      widgetInstanceId,
      "Codex Direct Work could not be run for this widget.",
    );

    return startDirectWorkStreamSession({
      bumpWidgetLogRefreshToken,
      currentSessionActivity,
      onEvent,
      request,
      widgetInstanceId,
      workbenchId,
      workspaceId: viewState.workspace.id,
    });
  }

  async function attachToCodexDirectWorkStreamForWidget(
    widgetInstanceId: WidgetInstanceId,
    runId: string,
    onEvent: (event: DirectWorkStreamEvent) => void,
  ): Promise<CodexDirectWorkStreamSession | null> {
    const workbenchId = requireOpenWorkbench(
      viewState,
      "attach Codex Direct Work",
    );
    requireWidget(
      viewState,
      widgetInstanceId,
      "Codex Direct Work could not be attached for this widget.",
    );

    return attachDirectWorkStreamSession({
      bumpWidgetLogRefreshToken,
      currentSessionActivity,
      onEvent,
      runId,
      widgetInstanceId,
      workbenchId,
      workspaceId: viewState.workspace.id,
    });
  }

  return {
    attachToCodexDirectWorkStream: attachToCodexDirectWorkStreamForWidget,
    cancelCodexDirectWorkRun: cancelCodexDirectWorkRunForWidget,
    forceKillCodexDirectWorkRun: forceKillCodexDirectWorkRunForWidget,
    getAgentExecutorDiffSummary: loadAgentExecutorDiffSummary,
    getAgentExecutorRunDetail: loadAgentExecutorRunDetail,
    listAgentExecutorRuns: loadAgentExecutorRuns,
    listenToDirectWorkStreamEvents,
    runCodexDirectWork: runCodexDirectWorkForWidget,
    runDirectWorkValidation: runDirectWorkValidationForWidget,
    startCodexDirectWorkStream: startCodexDirectWorkStreamForWidget,
  };
}
