import { useMemo, useRef, useState } from "react";

import { WidgetDebugPopup } from "../../../design-system";
import {
  WidgetV2BottomDrawer,
  WidgetV2PanelLayout,
  WidgetV2RightInspector,
  WidgetV2Shell,
  WidgetV2Toolbar,
} from "../WidgetV2Shell";
import type { WidgetV2StatusSummary } from "../widgetV2Types";
import { getWidgetV2Manifest } from "../widgetV2Registry";
import type {
  AgentContextSnapshot,
  AgentRunEvent,
  CodexAgentRuntimeActions,
  CodexAgentRuntimeAdapter,
} from "../../agentRuntime";
import { createCodexAgentRuntimeAdapter } from "../../agentRuntime";
import type { WorkspaceAgentQueueBridge } from "../../workspaceAgentQueueBridge";
import type {
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
} from "../../../workspace/types";
import { WorkspaceAgentV2ActivityPane } from "./WorkspaceAgentV2ActivityPane";
import { WorkspaceAgentV2Composer } from "./WorkspaceAgentV2Composer";
import {
  WorkspaceAgentV2ContextStrip,
  type WorkspaceAgentV2ContextItem,
} from "./WorkspaceAgentV2ContextStrip";
import { WorkspaceAgentV2Transcript } from "./WorkspaceAgentV2Transcript";
import { WorkspaceAgentV2TopBar } from "./WorkspaceAgentV2TopBar";
import { WorkspaceAgentV2DebugContent } from "./debug/WorkspaceAgentV2DebugContent";
import { buildWorkspaceAgentV2DebugModel } from "./debug/workspaceAgentV2DebugModel";
import { useWorkspaceAgentV2DirectRun } from "./useWorkspaceAgentV2DirectRun";
import { isWorkspaceAgentV2DirectRunBusy } from "./workspaceAgentV2DirectRunModel";
import { useWorkspaceAgentV2QueueRun } from "./useWorkspaceAgentV2QueueRun";
import {
  isWorkspaceAgentV2QueueRunBusy,
  workspaceAgentV2QueueRunCreatedEvent,
  workspaceAgentV2QueueRunTranscriptMessage,
  type WorkspaceAgentV2QueueRunControllerResult,
} from "./workspaceAgentV2QueueRunModel";

const workspaceAgentV2Manifest = getWidgetV2Manifest("workspace-agent-v2");

type WorkspaceAgentV2WidgetProps = {
  readonly activityEvents?: readonly AgentRunEvent[];
  readonly adapter?: CodexAgentRuntimeAdapter;
  readonly approvalPolicy?: DirectWorkApprovalPolicy;
  readonly codexExecutable?: string;
  readonly contextItems?: readonly WorkspaceAgentV2ContextItem[];
  readonly currentRunId?: string;
  readonly directRunSupported?: boolean;
  readonly initialPrompt?: string;
  readonly onCancelCodexDirectWorkRun?: CodexAgentRuntimeActions["cancelCodexDirectWorkRun"];
  readonly onContextAddPlaceholder?: () => void;
  readonly onContextRemove?: (itemId: string) => void;
  readonly onOpenQueue?: () => void;
  readonly onOpenQueueTask?: (queueItemId: string) => void;
  readonly onQueueTaskCreate?: (queueItemId?: string) => void;
  readonly onRunRequest?: () => void;
  readonly onStartCodexDirectWorkStream?: CodexAgentRuntimeActions["startCodexDirectWorkStream"];
  readonly queueBridge?: Pick<
    WorkspaceAgentQueueBridge,
    "attachKnowledgeToQueueTask" | "attachSkillToQueueTask" | "createItem"
  > | null;
  readonly queueRunPriority?: number;
  readonly queueRunTags?: readonly string[];
  readonly sandbox?: DirectWorkSandbox;
  readonly visibleContextSnapshot?: AgentContextSnapshot;
  readonly widgetInstanceId?: string;
  readonly workingDirectory?: string | null;
  readonly workspaceId?: string;
};

export function WorkspaceAgentV2Widget({
  activityEvents,
  adapter,
  approvalPolicy = "never",
  codexExecutable = "codex",
  contextItems,
  currentRunId,
  directRunSupported,
  initialPrompt = "",
  onCancelCodexDirectWorkRun,
  onContextAddPlaceholder,
  onContextRemove,
  onOpenQueue,
  onOpenQueueTask,
  onQueueTaskCreate,
  onRunRequest,
  onStartCodexDirectWorkStream,
  queueBridge,
  queueRunPriority,
  queueRunTags,
  sandbox = "workspace_write",
  visibleContextSnapshot,
  widgetInstanceId = "workspace-agent-v2-widget",
  workingDirectory = "",
  workspaceId = "workspace-agent-v2-preview",
}: WorkspaceAgentV2WidgetProps = {}) {
  const [newThread, setNewThread] = useState(false);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [isActivityVisible, setIsActivityVisible] = useState(true);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [queueActivityEvents, setQueueActivityEvents] = useState<
    readonly AgentRunEvent[]
  >([]);
  const [queueTranscriptMessages, setQueueTranscriptMessages] = useState<
    readonly ReturnType<typeof workspaceAgentV2QueueRunTranscriptMessage>[]
  >([]);
  const queueEventSequenceRef = useRef(0);
  const runtimeAdapter = useMemo(
    () =>
      adapter ??
      createCodexAgentRuntimeAdapter({
        cancelCodexDirectWorkRun: onCancelCodexDirectWorkRun,
        startCodexDirectWorkStream: onStartCodexDirectWorkStream,
      }),
    [adapter, onCancelCodexDirectWorkRun, onStartCodexDirectWorkStream],
  );
  const isAdapterSupported =
    directRunSupported ?? Boolean(adapter || onStartCodexDirectWorkStream);
  const controller = useWorkspaceAgentV2DirectRun({
    adapter: runtimeAdapter,
    approvalPolicy,
    codexExecutable,
    initialActivityEvents: activityEvents,
    sandbox,
    visibleContextSnapshot,
    widgetInstanceId,
    workingDirectory,
    workspaceId,
  });
  const queueRunController = useWorkspaceAgentV2QueueRun({
    contextItems,
    createdFromRunId: controller.currentRunId ?? currentRunId ?? null,
    onResult: (result) => {
      if (result.status === "created") {
        onQueueTaskCreate?.(result.createdTask?.id);
        appendQueueRunUiResult(result, {
          onOpenQueueTask,
          onOpenQueue,
          onCreateAnotherQueueTask: () => setPrompt(""),
          queueEventSequenceRef,
          setQueueActivityEvents,
          setQueueTranscriptMessages,
        });
      }
    },
    priority: queueRunPriority,
    queueBridge,
    tags: queueRunTags,
    visibleContextSnapshot,
  });
  const isBusy = isWorkspaceAgentV2DirectRunBusy(controller.status);
  const isQueueBusy = isWorkspaceAgentV2QueueRunBusy(queueRunController.status);
  const directRunDisabledReason = directRunDisabledReasonFor({
    isAdapterSupported,
    isBusy,
    prompt,
  });
  const queueRunDisabledReason = queueRunDisabledReasonFor({
    isQueueBusy,
    isQueueCreateSupported: Boolean(queueBridge?.createItem),
    prompt,
  });
  const directRunWarnings = useMemo(
    () =>
      uniqueWarnings([
        ...contextWarnings(contextItems),
        ...capabilityWarnings(runtimeAdapter, isAdapterSupported),
        ...controller.warnings,
        ...queueRunController.warnings,
      ]),
    [
      contextItems,
      controller.warnings,
      isAdapterSupported,
      queueRunController.warnings,
      runtimeAdapter,
    ],
  );
  const transcriptMessages = useMemo(
    () => [...controller.transcriptMessages, ...queueTranscriptMessages],
    [controller.transcriptMessages, queueTranscriptMessages],
  );
  const activityPaneEvents = useMemo(
    () => [...controller.activityEvents, ...queueActivityEvents],
    [controller.activityEvents, queueActivityEvents],
  );
  const hasActivity = activityPaneEvents.length > 0;
  const currentActivityRunId =
    controller.currentRunId ?? currentRunId ?? queueRunController.result?.createdTask?.id;
  const contextWarningCount = contextWarnings(contextItems).length;
  const contextCount =
    visibleContextSnapshot?.contextRefs.length ?? contextItems?.length ?? 0;
  const shouldShowContextStrip =
    Boolean(onContextAddPlaceholder) || Boolean(contextItems && contextItems.length > 0);
  const debugModel = useMemo(
    () =>
      buildWorkspaceAgentV2DebugModel({
        activityEventCount: activityPaneEvents.length,
        approvalPolicy,
        callbackAvailability: {
          cancelRun: Boolean(onCancelCodexDirectWorkRun),
          contextAddPlaceholder: Boolean(onContextAddPlaceholder),
          contextRemove: Boolean(onContextRemove),
          openQueue: Boolean(onOpenQueue),
          openQueueTask: Boolean(onOpenQueueTask),
          queueTaskCreate: Boolean(onQueueTaskCreate),
          runRequest: Boolean(onRunRequest),
          startRunStream: Boolean(onStartCodexDirectWorkStream),
        },
        codexExecutable,
        contextCount,
        contextWarningCount,
        currentRunId: currentActivityRunId,
        directRunDisabledReason,
        directRunStatus: controller.status,
        directRunSupported: isAdapterSupported,
        directRunWarningCount: directRunWarnings.length,
        queueBridgeState: {
          attachKnowledgeToQueueTask: Boolean(queueBridge?.attachKnowledgeToQueueTask),
          attachSkillToQueueTask: Boolean(queueBridge?.attachSkillToQueueTask),
          createItem: Boolean(queueBridge?.createItem),
        },
        queueRunDisabledReason,
        queueRunStatus: queueRunController.status,
        sandbox,
        toolPolicyAllowedCount:
          runtimeAdapter.capabilities.toolPolicy.allowedTools.length,
        visibleContextSnapshotId: visibleContextSnapshot?.id,
        widgetInstanceId,
        workingDirectory,
        workspaceId,
      }),
    [
      activityPaneEvents.length,
      approvalPolicy,
      codexExecutable,
      contextCount,
      contextWarningCount,
      controller.status,
      currentActivityRunId,
      directRunDisabledReason,
      directRunWarnings.length,
      isAdapterSupported,
      onCancelCodexDirectWorkRun,
      onContextAddPlaceholder,
      onContextRemove,
      onOpenQueue,
      onOpenQueueTask,
      onQueueTaskCreate,
      onRunRequest,
      onStartCodexDirectWorkStream,
      queueBridge?.attachKnowledgeToQueueTask,
      queueBridge?.attachSkillToQueueTask,
      queueBridge?.createItem,
      queueRunController.status,
      queueRunDisabledReason,
      runtimeAdapter.capabilities.toolPolicy.allowedTools.length,
      sandbox,
      visibleContextSnapshot?.id,
      widgetInstanceId,
      workingDirectory,
      workspaceId,
    ],
  );
  const shellStatus: WidgetV2StatusSummary | undefined = isBusy || isQueueBusy || !isAdapterSupported
    ? {
        detail: isBusy
          ? "Direct Run is active."
          : isQueueBusy
            ? "Queue task creation is in progress."
          : "Codex Direct Run is unsupported by this Workspace Agent v2 adapter.",
        label: isBusy || isQueueBusy ? "Running" : "Unsupported",
        tone: isBusy || isQueueBusy ? "working" : "error",
      }
    : undefined;

  function handleDirectRun() {
    onRunRequest?.();
    void controller.startDirectRun(prompt);
  }

  function handleQueueRun() {
    void queueRunController.startQueueRun(prompt);
  }

  function copyDebugDiagnostics() {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      return;
    }

    void navigator.clipboard.writeText(JSON.stringify(debugModel, null, 2));
  }

  return (
    <>
      <WidgetV2Shell
        status={shellStatus}
        subtitle="Plan a visible Workspace Agent step, run it directly when configured, or create a draft Queue task for later."
        title={workspaceAgentV2Manifest?.title ?? "Workspace Agent v2"}
      >
      <WidgetV2Toolbar label="Workspace Agent v2 controls">
        <WorkspaceAgentV2TopBar
          isActivityVisible={isActivityVisible}
          onActivityToggle={
            hasActivity ? () => setIsActivityVisible((current) => !current) : undefined
          }
          onDebugOpen={() => setIsDebugOpen(true)}
        />
      </WidgetV2Toolbar>
      <WidgetV2PanelLayout
        bottomDrawer={
          <WidgetV2BottomDrawer label="Workspace Agent v2 composer">
            {shouldShowContextStrip ? (
              <WorkspaceAgentV2ContextStrip
                items={contextItems}
                onAddPlaceholder={onContextAddPlaceholder}
                onRemoveItem={onContextRemove}
              />
            ) : null}
            <WorkspaceAgentV2Composer
              directRunDisabled={Boolean(directRunDisabledReason)}
              directRunDisabledReason={directRunDisabledReason}
              directRunLabel={isBusy ? "Direct Run running" : "Direct Run"}
              errorMessage={controller.errorMessage ?? queueRunController.errorMessage}
              newThread={newThread}
              onDirectRun={handleDirectRun}
              onNewThreadChange={setNewThread}
              onPromptChange={setPrompt}
              onQueueRun={handleQueueRun}
              prompt={prompt}
              queueRunDisabled={Boolean(queueRunDisabledReason)}
              queueRunDisabledReason={queueRunDisabledReason}
              queueRunLabel={isQueueBusy ? "Queue Run creating" : "Queue Run"}
            />
          </WidgetV2BottomDrawer>
        }
        primary={
          <WorkspaceAgentV2Transcript
            emptyState={
              <>
                <h3>Transcript</h3>
                <p>
                  Start with a prompt. Only visible prompt text and explicitly
                  attached context are used.
                </p>
              </>
            }
            messages={transcriptMessages}
          />
        }
        primaryLabel="Workspace Agent v2 transcript"
        rightInspector={
          isActivityVisible && hasActivity ? (
            <WidgetV2RightInspector label="Workspace Agent v2 activity pane">
              <WorkspaceAgentV2ActivityPane
                currentRunId={currentActivityRunId ?? undefined}
                events={activityPaneEvents}
                onRequestHide={() => setIsActivityVisible(false)}
              />
            </WidgetV2RightInspector>
          ) : null
        }
      />
      </WidgetV2Shell>
      <WidgetDebugPopup
        copyDiagnostics={{ label: "Copy diagnostics", onCopy: copyDebugDiagnostics }}
        onClose={() => setIsDebugOpen(false)}
        open={isDebugOpen}
        title="Workspace Agent V2 diagnostics"
      >
        <WorkspaceAgentV2DebugContent model={debugModel} />
      </WidgetDebugPopup>
    </>
  );
}

function queueRunDisabledReasonFor({
  isQueueBusy,
  isQueueCreateSupported,
  prompt,
}: {
  readonly isQueueBusy: boolean;
  readonly isQueueCreateSupported: boolean;
  readonly prompt: string;
}) {
  if (!prompt.trim()) {
    return "Enter a prompt before creating a Queue task.";
  }

  if (!isQueueCreateSupported) {
    return "Queue task creation is unavailable in this Workspace Agent v2 host.";
  }

  if (isQueueBusy) {
    return "Queue Run is already creating a task.";
  }

  return undefined;
}

function directRunDisabledReasonFor({
  isAdapterSupported,
  isBusy,
  prompt,
}: {
  readonly isAdapterSupported: boolean;
  readonly isBusy: boolean;
  readonly prompt: string;
}) {
  if (!prompt.trim()) {
    return "Enter a prompt before starting Direct Run.";
  }

  if (!isAdapterSupported) {
    return "Codex Direct Run is unsupported by this Workspace Agent v2 adapter.";
  }

  if (isBusy) {
    return "Direct Run is already running.";
  }

  return undefined;
}

function appendQueueRunUiResult(
  result: WorkspaceAgentV2QueueRunControllerResult,
  {
    onCreateAnotherQueueTask,
    onOpenQueue,
    onOpenQueueTask,
    queueEventSequenceRef,
    setQueueActivityEvents,
    setQueueTranscriptMessages,
  }: {
    readonly onOpenQueueTask?: (queueItemId: string) => void;
    readonly onOpenQueue?: () => void;
    readonly onCreateAnotherQueueTask?: () => void;
    readonly queueEventSequenceRef: { current: number };
    readonly setQueueActivityEvents: (
      updater: (events: readonly AgentRunEvent[]) => readonly AgentRunEvent[],
    ) => void;
    readonly setQueueTranscriptMessages: (
      updater: (
        messages: readonly ReturnType<
          typeof workspaceAgentV2QueueRunTranscriptMessage
        >[],
      ) => readonly ReturnType<typeof workspaceAgentV2QueueRunTranscriptMessage>[],
    ) => void;
  },
) {
  queueEventSequenceRef.current += 1;
  const sequence = queueEventSequenceRef.current;

  setQueueTranscriptMessages((messages) => [
    ...messages,
    workspaceAgentV2QueueRunTranscriptMessage({
      onOpenTask: onOpenQueueTask,
      onOpenQueue,
      onCreateAnother: onCreateAnotherQueueTask,
      result,
      sequence,
    }),
  ]);
  setQueueActivityEvents((events) => [
    ...events,
    workspaceAgentV2QueueRunCreatedEvent({
      result,
      sequence,
      timestampMs: Date.now(),
    }),
  ]);
}

function contextWarnings(
  contextItems: readonly WorkspaceAgentV2ContextItem[] | undefined,
) {
  return (contextItems ?? []).flatMap((item) =>
    (item.warnings ?? []).map(
      (warning) => `${item.label}: context warning ${warning.replace(/_/g, " ")}`,
    ),
  );
}

function capabilityWarnings(
  adapter: CodexAgentRuntimeAdapter,
  isAdapterSupported: boolean,
) {
  const warnings: string[] = [];

  if (!isAdapterSupported) {
    warnings.push("Codex Direct Work stream API is unavailable in this host.");
  }

  if (!adapter.capabilities.supportsCancellation) {
    warnings.push("Cancellation is unavailable for this Codex adapter instance.");
  }

  if (!adapter.capabilities.supportsFileChangeSummary) {
    warnings.push(
      "Changed-file summaries are not reported by this adapter; use explicit Git/Finder review.",
    );
  }

  if (adapter.capabilities.toolPolicy.allowedTools.length > 0) {
    warnings.push("Workspace Agent v2 Direct Run keeps Hobit provider tools disabled.");
  }

  return warnings;
}

function uniqueWarnings(warnings: readonly string[]) {
  return Array.from(new Set(warnings.filter(Boolean)));
}
