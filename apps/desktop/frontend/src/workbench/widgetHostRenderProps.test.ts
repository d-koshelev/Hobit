import { describe, expect, it, vi } from "vitest";

import type { DirectWorkGitReviewHandoff } from "./useDirectWorkGitReviewHandoff";
import type { DirectWorkRunHandoffController } from "./useDirectWorkRunHandoff";
import type { WorkbenchWidgetInstanceActions } from "./useWorkbenchWidgetActions";
import { widgetHostRenderProps } from "./widgetHostRenderProps";
import type { WorkspaceQueueApi } from "./queue/useWorkspaceQueueApi";
import {
  buildPromptPackImportPreview,
  parsePromptPackImportPlan,
} from "./promptPack";
import { createUnavailableValidationRunner } from "./validation";
import {
  AGENT_ACTIVITY_COMPONENT_KEY,
  AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY,
  AGENT_RUN_PLACEHOLDER_COMPONENT_KEY,
  FINDER_WIDGET_COMPONENT_KEY,
  GIT_PLACEHOLDER_COMPONENT_KEY,
  INTERACTIVE_AGENT_PLACEHOLDER_COMPONENT_KEY,
  JDBC_WIDGET_COMPONENT_KEY,
  NOTES_PLACEHOLDER_COMPONENT_KEY,
  RUNBOOK_PLACEHOLDER_COMPONENT_KEY,
  SKILL_LIBRARY_COMPONENT_KEY,
  TERMINAL_PLACEHOLDER_COMPONENT_KEY,
} from "./widgetRegistry";

describe("widgetHostRenderProps", () => {
  it("keeps shared frame props available without leaking widget actions", () => {
    const actions = widgetActions();
    const props = renderPropsFor(RUNBOOK_PLACEHOLDER_COMPONENT_KEY, {
      widgetActions: actions,
    });

    expect(props.onLoadLogs).toBe(actions.listWidgetLogs);
    expect(props.onUpdateLayout).toBe(actions.updateWidgetLayout);
    expect(props.onUpdateState).toBe(actions.updateWidgetState);
    expect(props.onCreateGitCommit).toBeUndefined();
    expect(props.onGetGitRepositoryStatus).toBeUndefined();
    expect(props.onCreateTerminalPtySession).toBeUndefined();
    expect(props.onCreateAgentQueueTask).toBeUndefined();
  });

  it("wires Workspace Agent directory, Knowledge, activity, Direct Work, and Queue bridge callbacks", async () => {
    const actions = widgetActions();
    const publish = vi.fn();
    const workspaceQueue = workspaceQueueApi({
      runAutonomousQueue: vi.fn(async () => ({
        action: "queue.runAutonomousQueue" as const,
        message: "Autonomous Queue started.",
        ok: true,
        status: "running",
      })),
      stopAutonomousQueueAfterCurrent: vi.fn(async () => ({
        action: "queue.stopAutonomousQueueAfterCurrent" as const,
        message: "Autonomous Queue will stop after the current task.",
        ok: true,
        status: "stopping",
      })),
    });
    const props = renderPropsFor(INTERACTIVE_AGENT_PLACEHOLDER_COMPONENT_KEY, {
      coordinatorAttachedContextRequest: {
        contextText: "visible context",
        id: 1,
        sourceLabel: "Queue",
        targetCoordinatorWidgetInstanceId: "widget_1",
      },
      onPublishAgentActivityEvents: publish,
      widgetActions: actions,
      workspaceQueueApi: workspaceQueue,
    });

    expect(props.coordinatorAttachedContextRequest?.contextText).toBe(
      "visible context",
    );
    expect(props.onCancelCodexDirectWorkRun).toBe(
      actions.cancelCodexDirectWorkRun,
    );
    expect(props.onCreateAgentQueueTask).toBe(actions.createAgentQueueTask);
    expect(props.onCreateKnowledgeDocument).toBe(
      actions.createKnowledgeDocument,
    );
    expect(props.onCreateSkill).toBe(actions.createSkill);
    expect(props.onCreateWorkspaceNote).toBe(actions.createWorkspaceNote);
    expect(props.onExecuteJdbcReadOnlyQuery).toBeUndefined();
    expect(props.onCreateJdbcConnectionProfile).toBeUndefined();
    expect(props.onDeleteJdbcConnectionProfile).toBeUndefined();
    expect(props.onListJdbcConnectionProfiles).toBeUndefined();
    expect(props.onListJdbcConnectors).toBeUndefined();
    expect(props.onUpdateJdbcConnectionProfile).toBeUndefined();
    expect(props.onValidateJdbcReadOnlySql).toBeUndefined();
    expect(props.onGenerateCoordinatorProviderResponse).toBe(
      actions.generateCoordinatorProviderResponse,
    );
    expect(props.onGetKnowledgeDocument).toBe(actions.getKnowledgeDocument);
    expect(props.workspaceAgentQueueBridge).toBeDefined();
    expect(props.createQueueItemsFromPromptPackPreview).toBeDefined();
    expect(props.workspaceAgentQueueBridge?.getRunSettingsDefaults?.()).toEqual(
      {
        approvalPolicy: "never",
        codexExecutable: "codex.cmd",
        executionWorkspace: "C:/repo",
        sandbox: "read_only",
      },
    );
    await props.workspaceAgentQueueBridge?.runAutonomousQueue?.();
    await props.workspaceAgentQueueBridge?.stopAutonomousQueueAfterCurrent?.();
    expect(workspaceQueue.runAutonomousQueue).toHaveBeenCalledTimes(1);
    expect(
      workspaceQueue.stopAutonomousQueueAfterCurrent,
    ).toHaveBeenCalledTimes(1);
    expect(props.onPublishAgentActivityEvents).toBe(publish);
    expect(props.onSearchKnowledgeDocuments).toBe(
      actions.searchKnowledgeDocuments,
    );
    expect(props.onSelectWorkspaceDirectory).toBe(
      actions.selectWorkspaceDirectory,
    );
    expect(props.onReadPromptPackSource).toBe(actions.readPromptPackSource);
    expect(props.onStartCodexDirectWorkStream).toBe(
      actions.startCodexDirectWorkStream,
    );
    expect(props.onAttachContextToCoordinator).toBeUndefined();
    expect(props.onGetWorkspaceNote).toBeUndefined();
    expect(props.onRunTerminalCommand).toBeUndefined();
  });

  it("passes current Workspace root to QueueV2 and prompt-pack materialization", async () => {
    const createItem = vi.fn(async (request) => ({
      action: "queue.createItem" as const,
      events: [],
      item: {
        blockers: [],
        dependencies: [],
        description: request.description,
        evidenceSummary: { runRefs: [], status: "none" as const },
        executionPolicy: request.executionPolicy ?? "manual",
        executionStatus: request.status ?? "draft",
        id: "queue-001",
        priority: request.priority,
        prompt: request.prompt,
        queueId: "queue",
        queueTag: { id: null, name: request.queueTag?.name ?? null },
        reportSummary: { status: "none" as const },
        runLinks: [],
        status: request.status ?? "draft",
        title: request.title,
        workspaceId: "workspace-1",
      },
      message: "created",
      ok: true,
      safetyClass: "safe_create_update" as const,
    }));
    const workspaceQueue = workspaceQueueApi({
      createItem,
      getCurrentWorkspaceRoot: () => "C:/Users/Dmitry/Documents/prj/Hobit_fixed",
      getRunSettingsDefaults: () => ({
        approvalPolicy: "never",
        codexExecutable: "codex.cmd",
        executionWorkspace: "~",
        sandbox: "read_only",
      }),
    });
    const queueProps = renderPropsFor(AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY, {
      currentWorkspaceRoot: "C:/Users/Dmitry/Documents/prj/Hobit_fixed",
      workspaceQueueApi: workspaceQueue,
    });
    const agentProps = renderPropsFor(
      INTERACTIVE_AGENT_PLACEHOLDER_COMPONENT_KEY,
      {
        currentWorkspaceRoot: "C:/Users/Dmitry/Documents/prj/Hobit_fixed",
        workspaceQueueApi: workspaceQueue,
      },
    );
    const preview = buildPromptPackImportPreview(
      parsePromptPackImportPlan([
        {
          path: "001.md",
          text: ["# 001", "", "Imported prompt body."].join("\n"),
        },
      ]),
    );

    expect(queueProps.currentWorkspaceRoot).toBe(
      "C:/Users/Dmitry/Documents/prj/Hobit_fixed",
    );

    const result = await agentProps.createQueueItemsFromPromptPackPreview?.(
      preview,
    );

    expect(result?.ok).toBe(true);
    expect(createItem).toHaveBeenCalledTimes(1);
    expect(createItem.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        executionWorkspace: "C:/Users/Dmitry/Documents/prj/Hobit_fixed",
        status: "draft",
      }),
    );
  });

  it("routes current-session Agent Activity events to Agent Activity and Workspace Agent", () => {
    const publish = vi.fn();
    const activityEvents = [agentActivityEvent()];

    expect(
      renderPropsFor(AGENT_ACTIVITY_COMPONENT_KEY, {
        agentActivityEvents: activityEvents,
        onPublishAgentActivityEvents: publish,
      }).agentActivityEvents,
    ).toBe(activityEvents);
    expect(
      renderPropsFor(INTERACTIVE_AGENT_PLACEHOLDER_COMPONENT_KEY, {
        agentActivityEvents: activityEvents,
        onPublishAgentActivityEvents: publish,
      }).agentActivityEvents,
    ).toBe(activityEvents);
    expect(
      renderPropsFor(INTERACTIVE_AGENT_PLACEHOLDER_COMPONENT_KEY, {
        agentActivityEvents: activityEvents,
        onPublishAgentActivityEvents: publish,
      }).onPublishAgentActivityEvents,
    ).toBe(publish);
  });

  it("wires Finder to directory selection and Queue task creation without execution actions", () => {
    const actions = widgetActions();
    const attach = vi.fn();
    const props = renderPropsFor(FINDER_WIDGET_COMPONENT_KEY, {
      onAttachContextToCoordinator: attach,
      widgetActions: actions,
    });

    expect(props.onAttachContextToCoordinator).toBe(attach);
    expect(props.onSelectWorkspaceDirectory).toBe(
      actions.selectWorkspaceDirectory,
    );
    expect(props.onCreateAgentQueueTask).toBe(actions.createAgentQueueTask);
    expect(props.onGetGitRepositoryStatus).toBeUndefined();
    expect(props.onGetGitFileDiff).toBeUndefined();
    expect(props.onCreateGitCommit).toBeUndefined();
    expect(props.onRunTerminalCommand).toBeUndefined();
    expect(props.onRunCodexDirectWork).toBeUndefined();
    expect(props.onUpdateState).toBe(actions.updateWidgetState);
  });

  it("wires Git review and local commit props only to Git", () => {
    const actions = widgetActions();
    const directWorkGitReview = directWorkGitReviewHandoff();
    const props = renderPropsFor(GIT_PLACEHOLDER_COMPONENT_KEY, {
      directWorkGitReview,
      widgetActions: actions,
    });

    expect(props.directWorkGitReviewRequest).toBe(directWorkGitReview.request);
    expect(props.onCreateGitCommit).toBe(actions.createGitCommit);
    expect(props.onDirectWorkGitReviewStatusChange).toBe(
      directWorkGitReview.updateStatus,
    );
    expect(props.onGetGitFileDiff).toBe(actions.getGitFileDiff);
    expect(props.onGetGitLog).toBe(actions.getGitLog);
    expect(props.onGetGitRepositoryStatus).toBe(actions.getGitRepositoryStatus);
    expect(props.onRunTerminalCommand).toBeUndefined();

    expect(
      renderPropsFor(TERMINAL_PLACEHOLDER_COMPONENT_KEY, {
        widgetActions: actions,
      }).onGetGitRepositoryStatus,
    ).toBeUndefined();
  });

  it("wires Terminal PTY and fallback command props only to Terminal", () => {
    const actions = widgetActions();
    const props = renderPropsFor(TERMINAL_PLACEHOLDER_COMPONENT_KEY, {
      widgetActions: actions,
    });

    expect(props.onRunTerminalCommand).toBe(actions.runTerminalCommand);
    expect(props.onCreateTerminalPtySession).toBe(
      actions.createTerminalPtySession,
    );
    expect(props.onWriteTerminalPtySession).toBe(
      actions.writeTerminalPtySession,
    );
    expect(props.onResizeTerminalPtySession).toBe(
      actions.resizeTerminalPtySession,
    );
    expect(props.onStopTerminalPtySession).toBe(
      actions.stopTerminalPtySession,
    );
    expect(props.onKillTerminalPtySession).toBe(
      actions.killTerminalPtySession,
    );
    expect(props.onCloseTerminalPtySession).toBe(
      actions.closeTerminalPtySession,
    );
    expect(props.onGetTerminalPtySession).toBe(actions.getTerminalPtySession);
    expect(props.onListTerminalPtySessions).toBe(
      actions.listTerminalPtySessions,
    );
    expect(props.onCreateGitCommit).toBeUndefined();
    expect(props.onCreateWorkspaceNote).toBeUndefined();
  });

  it("wires Knowledge / Skills document, skill, import, and attach props", () => {
    const actions = widgetActions();
    const attach = vi.fn();
    const props = renderPropsFor(SKILL_LIBRARY_COMPONENT_KEY, {
      onAttachContextToCoordinator: attach,
      widgetActions: actions,
    });

    expect(props.onAttachContextToCoordinator).toBe(attach);
    expect(props.onCreateAgentQueueTask).toBe(actions.createAgentQueueTask);
    expect(props.onCreateKnowledgeDocument).toBe(
      actions.createKnowledgeDocument,
    );
    expect(props.onCreateSkill).toBe(actions.createSkill);
    expect(props.onDeleteKnowledgeDocument).toBe(
      actions.deleteKnowledgeDocument,
    );
    expect(props.onDeleteSkill).toBe(actions.deleteSkill);
    expect(props.onGetKnowledgeDocument).toBe(actions.getKnowledgeDocument);
    expect(props.onGetSkill).toBe(actions.getSkill);
    expect(props.onListKnowledgeDocuments).toBe(
      actions.listKnowledgeDocuments,
    );
    expect(props.onListSkills).toBe(actions.listSkills);
    expect(props.onReadKnowledgeDocumentImportFile).toBe(
      actions.readKnowledgeDocumentImportFile,
    );
    expect(props.onUpdateKnowledgeDocument).toBe(
      actions.updateKnowledgeDocument,
    );
    expect(props.onUpdateSkill).toBe(actions.updateSkill);
    expect(props.onLoadLogs).toBeUndefined();
    expect(props.onUpdateLayout).toBeUndefined();
    expect(props.onUpdateState).toBeUndefined();
    expect(props.onSelectWorkspaceDirectory).toBeUndefined();
    expect(props.onStartCodexDirectWorkStream).toBeUndefined();
  });

  it("wires Notes actions only to Notes", () => {
    const actions = widgetActions();
    const props = renderPropsFor(NOTES_PLACEHOLDER_COMPONENT_KEY, {
      widgetActions: actions,
    });

    expect(props.onCreateWorkspaceNote).toBe(actions.createWorkspaceNote);
    expect(props.onCreateKnowledgeDocument).toBe(
      actions.createKnowledgeDocument,
    );
    expect(props.onGetWorkspaceNote).toBe(actions.getWorkspaceNote);
    expect(props.onListWorkspaceNotes).toBe(actions.listWorkspaceNotes);
    expect(props.onUpdateWorkspaceNote).toBe(actions.updateWorkspaceNote);
    expect(props.onCreateSkill).toBeUndefined();
    expect(props.onCreateTerminalPtySession).toBeUndefined();
  });

  it("wires Agent Queue task, Executor handoff, attach, and run-link props", async () => {
    const actions = widgetActions();
    const attach = vi.fn();
    const openExecutorRun = vi.fn();
    const handoff = directWorkRunHandoffController();
    const slots = [
      {
        label: "Agent Executor",
        widgetInstanceId: "executor_1",
      },
    ];
    const props = renderPropsFor(AGENT_QUEUE_PLACEHOLDER_COMPONENT_KEY, {
      agentExecutorSlots: slots,
      directWorkRunHandoff: handoff,
      onAttachContextToCoordinator: attach,
      onOpenAgentExecutorRun: openExecutorRun,
      workspaceQueueApi: workspaceQueueApi({
        controller: { agentExecutorSlots: slots } as WorkspaceQueueApi["controller"],
        queueExecutorSlots: slots,
      }),
      widgetActions: actions,
    });

    expect(props.agentExecutorSlots).toBe(slots);
    expect(props.agentQueueController?.agentExecutorSlots).toBe(slots);
    expect(props.onAttachContextToCoordinator).toBe(attach);
    expect(props.onCreateKnowledgeDocument).toBe(
      actions.createKnowledgeDocument,
    );
    expect(props.onCreateSkill).toBe(actions.createSkill);
    expect(props.onOpenAgentExecutorRun).toBe(openExecutorRun);
    expect(props.onAssignAgentQueueTaskToExecutor).toBeUndefined();
    expect(props.onCreateAgentQueueTask).toBeUndefined();
    expect(props.onStartAssignedAgentQueueTask).toBeUndefined();
    expect(props.onRunCodexDirectWork).toBeUndefined();
  });

  it("wires Agent Executor Direct Work, history, activity, and Git handoff props", () => {
    const actions = widgetActions();
    const attach = vi.fn();
    const publish = vi.fn();
    const directWorkGitReview = directWorkGitReviewHandoff();
    const directWorkRunHandoff = directWorkRunHandoffController();
    const props = renderPropsFor(AGENT_RUN_PLACEHOLDER_COMPONENT_KEY, {
      agentExecutorRunOpenRequest: {
        executorWidgetInstanceId: "widget_1",
        id: 1,
        runId: "run_1",
      },
      directWorkGitReview,
      directWorkRunHandoff,
      hasGitWidget: true,
      onAttachContextToCoordinator: attach,
      onPublishAgentActivityEvents: publish,
      widgetActions: actions,
    });

    expect(props.agentExecutorRunOpenRequest?.runId).toBe("run_1");
    expect(props.directWorkGitReviewStatus).toBe(directWorkGitReview.status);
    expect(props.directWorkRunHandoff).toBe(
      directWorkRunHandoff.handoffs.widget_1,
    );
    expect(props.hasGitWidget).toBe(true);
    expect(props.onAttachContextToCoordinator).toBe(attach);
    expect(props.onAttachToCodexDirectWorkStream).toBe(
      actions.attachToCodexDirectWorkStream,
    );
    expect(props.onCancelCodexDirectWorkRun).toBe(
      actions.cancelCodexDirectWorkRun,
    );
    expect(props.onDirectWorkGitReviewRequested).toBe(
      directWorkGitReview.requestReview,
    );
    expect(props.onDirectWorkRunHandoffFinalState).toBe(
      directWorkRunHandoff.recordFinalState,
    );
    expect(props.onForceKillCodexDirectWorkRun).toBe(
      actions.forceKillCodexDirectWorkRun,
    );
    expect(props.onGetAgentExecutorDiffSummary).toBe(
      actions.getAgentExecutorDiffSummary,
    );
    expect(props.onGetAgentExecutorRunDetail).toBe(
      actions.getAgentExecutorRunDetail,
    );
    expect(props.onListAgentExecutorRuns).toBe(actions.listAgentExecutorRuns);
    expect(props.onPublishAgentActivityEvents).toBe(publish);
    expect(props.onRunCodexDirectWork).toBe(actions.runCodexDirectWork);
    expect(props.onRunDirectWorkValidation).toBe(
      actions.runDirectWorkValidation,
    );
    expect(props.onStartCodexDirectWorkStream).toBe(
      actions.startCodexDirectWorkStream,
    );
    expect(props.onCreateAgentQueueTask).toBeUndefined();
  });

  it("wires Database / JDBC preview callbacks only to JDBC", () => {
    const actions = widgetActions();
    const props = renderPropsFor(JDBC_WIDGET_COMPONENT_KEY, {
      widgetActions: actions,
    });

    expect(props.onCreateJdbcConnector).toBe(actions.createJdbcConnector);
    expect(props.onCreateJdbcConnectionProfile).toBe(
      actions.createJdbcConnectionProfile,
    );
    expect(props.onCheckJdbcSidecarHealth).toBe(
      actions.checkJdbcSidecarHealth,
    );
    expect(props.onDeleteJdbcConnectionProfile).toBe(
      actions.deleteJdbcConnectionProfile,
    );
    expect(props.onExecuteJdbcReadOnlyQuery).toBe(
      actions.executeJdbcReadOnlyQuery,
    );
    expect(props.onGetJdbcConnector).toBe(actions.getJdbcConnector);
    expect(props.onListJdbcConnectionProfiles).toBe(
      actions.listJdbcConnectionProfiles,
    );
    expect(props.onListJdbcConnectors).toBe(actions.listJdbcConnectors);
    expect(props.onProbeJdbcDriver).toBe(actions.probeJdbcDriver);
    expect(props.onUpdateJdbcConnectionProfile).toBe(
      actions.updateJdbcConnectionProfile,
    );
    expect(props.onUpdateJdbcConnector).toBe(actions.updateJdbcConnector);
    expect(props.onValidateJdbcReadOnlySql).toBe(
      actions.validateJdbcReadOnlySql,
    );
    expect(props.onCreateWorkspaceNote).toBeUndefined();
    expect(props.onGetGitRepositoryStatus).toBeUndefined();
  });
});

type RenderPropsOverrides = Partial<Parameters<typeof widgetHostRenderProps>[0]>;

function renderPropsFor(
  componentKey: string,
  overrides: RenderPropsOverrides = {},
) {
  return widgetHostRenderProps({
    agentActivityEvents: [],
    agentExecutorRunOpenRequest: null,
    agentQueueItemOpenRequest: null,
    agentExecutorSlots: [],
    componentKey,
    coordinatorAttachedContextRequest: null,
    queueReportActionCardRequest: null,
    queueTaskStatusCardRequest: null,
    directWorkGitReview: directWorkGitReviewHandoff(),
    directWorkRunHandoff: directWorkRunHandoffController(),
    hasGitWidget: false,
    instanceId: "widget_1",
    onAttachContextToCoordinator: undefined,
    onOpenAgentExecutorRun: vi.fn(),
    onPublishAgentActivityEvents: vi.fn(),
    widgetActions: widgetActions(),
    workspaceQueueApi: workspaceQueueApi(),
    ...overrides,
  });
}

function workspaceQueueApi(
  overrides: Partial<WorkspaceQueueApi> = {},
): WorkspaceQueueApi {
  return {
    controller: {} as WorkspaceQueueApi["controller"],
    createItem: vi.fn(),
    getCurrentWorkspaceRoot: vi.fn(() => null),
    getRunSettingsDefaults: vi.fn(() => ({
      approvalPolicy: "never" as const,
      codexExecutable: "codex.cmd",
      executionWorkspace: "C:/repo",
      sandbox: "read_only" as const,
    })),
    getSnapshot: vi.fn(),
    queueExecutorSlots: [],
    queueId: "workspace:workspace_1:agent-queue",
    requestValidation: vi.fn(),
    runAutonomousQueue: vi.fn(),
    stopAutonomousQueueAfterCurrent: vi.fn(),
    updateItem: vi.fn(),
    validationRunner: createUnavailableValidationRunner(),
    ...overrides,
  };
}

function agentActivityEvent() {
  return {
    id: "event-1",
    runId: "run-1",
    severity: "info" as const,
    sourceKind: "workspace-agent" as const,
    sourceLabel: "Workspace Agent",
    sourceWidgetInstanceId: "agent-1",
    status: "running" as const,
    timestamp: 1,
    timestampLabel: "0s",
    title: "Started run",
    workspaceId: "workspace-1",
  };
}

function directWorkGitReviewHandoff(): DirectWorkGitReviewHandoff {
  return {
    request: {
      id: 1,
      repositoryRoot: "C:/repo",
      sourceWidgetInstanceId: "widget_1",
    },
    requestReview: vi.fn(),
    status: {
      repositoryRoot: "C:/repo",
      repositoryStatus: null,
      requestId: 1,
      sourceWidgetInstanceId: "widget_1",
      state: "completed",
    },
    updateStatus: vi.fn(),
  };
}

function directWorkRunHandoffController(): DirectWorkRunHandoffController {
  return {
    handoffs: {
      widget_1: {
        executorWidgetInstanceId: "widget_1",
        id: 1,
        queueItemId: "queue_1",
        repoRoot: "C:/repo",
        runId: "run_1",
        startedAt: "2026-05-28T00:00:00Z",
        taskTitle: "Task",
        workbenchId: "workbench_1",
        workspaceId: "workspace_1",
      },
    },
    queueTaskAutoRefreshRequest: {
      completedAt: "2026-05-28T00:01:00Z",
      executorWidgetInstanceId: "widget_1",
      finalStatus: "completed",
      id: 1,
      queueItemId: "queue_1",
      repoRoot: "C:/repo",
      runId: "run_1",
      startedAt: "2026-05-28T00:00:00Z",
      taskTitle: "Task",
      workbenchId: "workbench_1",
      workspaceId: "workspace_1",
    },
    recordFinalState: vi.fn(),
    recordHandoff: vi.fn(),
  };
}

function widgetActions(): WorkbenchWidgetInstanceActions {
  return {
    assignAgentQueueTaskToExecutor: vi.fn(),
    attachToCodexDirectWorkStream: vi.fn(),
    cancelCodexDirectWorkRun: vi.fn(),
    clearAgentQueueTaskAssignment: vi.fn(),
    closeTerminalPtySession: vi.fn(),
    createAgentQueueTask: vi.fn(),
    createGitCommit: vi.fn(),
    createJdbcConnector: vi.fn(),
    createJdbcConnectionProfile: vi.fn(),
    checkJdbcSidecarHealth: vi.fn(),
    createKnowledgeDocument: vi.fn(),
    createSkill: vi.fn(),
    createTerminalPtySession: vi.fn(),
    createWorkspaceNote: vi.fn(),
    deleteAgentQueueTask: vi.fn(),
    deleteJdbcConnectionProfile: vi.fn(),
    deleteKnowledgeDocument: vi.fn(),
    deleteSkill: vi.fn(),
    executeJdbcReadOnlyQuery: vi.fn(),
    forceKillCodexDirectWorkRun: vi.fn(),
    generateCoordinatorProviderResponse: vi.fn(),
    getAgentExecutorDiffSummary: vi.fn(),
    getAgentExecutorRunDetail: vi.fn(),
    getAgentQueueRunnerSnapshot: vi.fn(),
    getAgentQueueTask: vi.fn(),
    getAgentQueueTaskLatestRunLink: vi.fn(),
    getGitFileDiff: vi.fn(),
    getGitLog: vi.fn(),
    getGitRepositoryStatus: vi.fn(),
    getJdbcConnector: vi.fn(),
    getKnowledgeDocument: vi.fn(),
    getSkill: vi.fn(),
    getTerminalPtySession: vi.fn(),
    getWorkspaceNote: vi.fn(),
    killTerminalPtySession: vi.fn(),
    listAgentExecutorRuns: vi.fn(),
    listAgentQueueTaskRunLinks: vi.fn(),
    listAgentQueueTasks: vi.fn(),
    listJdbcConnectionProfiles: vi.fn(),
    listJdbcConnectors: vi.fn(),
    listKnowledgeDocuments: vi.fn(),
    listSkills: vi.fn(),
    listTerminalPtySessions: vi.fn(),
    listWidgetLogs: vi.fn(),
    listWorkspaceNotes: vi.fn(),
    logRefreshTokens: {},
    probeJdbcDriver: vi.fn(),
    readKnowledgeDocumentImportFile: vi.fn(),
    readPromptPackSource: vi.fn(),
    removeWidgetInstance: vi.fn(),
    resizeTerminalPtySession: vi.fn(),
    runCodexDirectWork: vi.fn(),
    runDirectWorkValidation: vi.fn(),
    runTerminalCommand: vi.fn(),
    searchKnowledgeDocuments: vi.fn(),
    selectWorkspaceDirectory: vi.fn(),
    startAgentQueueRunnerSession: vi.fn(),
    startAssignedAgentQueueTask: vi.fn(),
    startCodexDirectWorkStream: vi.fn(),
    stopAgentQueueRunnerSession: vi.fn(),
    stopTerminalPtySession: vi.fn(),
    updateAgentQueueTask: vi.fn(),
    updateJdbcConnectionProfile: vi.fn(),
    updateJdbcConnector: vi.fn(),
    updateKnowledgeDocument: vi.fn(),
    updateSkill: vi.fn(),
    updateWidgetLayout: vi.fn(),
    updateWidgetState: vi.fn(),
    updateWorkspaceNote: vi.fn(),
    validateJdbcReadOnlySql: vi.fn(),
    writeTerminalPtySession: vi.fn(),
  } as unknown as WorkbenchWidgetInstanceActions;
}
