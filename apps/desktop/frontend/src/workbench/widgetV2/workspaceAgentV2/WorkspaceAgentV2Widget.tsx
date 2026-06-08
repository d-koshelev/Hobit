import { useMemo, useState } from "react";

import {
  WidgetV2BottomDrawer,
  WidgetV2PanelLayout,
  WidgetV2RightInspector,
  WidgetV2Shell,
  WidgetV2Toolbar,
} from "../WidgetV2Shell";
import { getWidgetV2Manifest } from "../widgetV2Registry";
import type {
  AgentContextSnapshot,
  AgentRunEvent,
  CodexAgentRuntimeActions,
  CodexAgentRuntimeAdapter,
} from "../../agentRuntime";
import { createCodexAgentRuntimeAdapter } from "../../agentRuntime";
import type {
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
} from "../../../workspace/types";
import { WorkspaceAgentV2ActivityPane } from "./WorkspaceAgentV2ActivityPane";
import {
  WorkspaceAgentV2Composer,
  type WorkspaceAgentV2PreflightItem,
} from "./WorkspaceAgentV2Composer";
import {
  WorkspaceAgentV2ContextStrip,
  type WorkspaceAgentV2ContextItem,
} from "./WorkspaceAgentV2ContextStrip";
import { WorkspaceAgentV2Transcript } from "./WorkspaceAgentV2Transcript";
import { WorkspaceAgentV2TopBar } from "./WorkspaceAgentV2TopBar";
import { useWorkspaceAgentV2DirectRun } from "./useWorkspaceAgentV2DirectRun";
import { isWorkspaceAgentV2DirectRunBusy } from "./workspaceAgentV2DirectRunModel";

const workspaceAgentV2Manifest = getWidgetV2Manifest("workspace-agent-v2");
const queueRunDisabledReason =
  "Queue Run is not implemented in this Workspace Agent v2 block; no Queue task will be created.";

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
  readonly onQueueTaskCreate?: () => void;
  readonly onRunRequest?: () => void;
  readonly onStartCodexDirectWorkStream?: CodexAgentRuntimeActions["startCodexDirectWorkStream"];
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
  onQueueTaskCreate,
  onRunRequest,
  onStartCodexDirectWorkStream,
  sandbox = "workspace_write",
  visibleContextSnapshot,
  widgetInstanceId = "workspace-agent-v2-widget",
  workingDirectory = "",
  workspaceId = "workspace-agent-v2-preview",
}: WorkspaceAgentV2WidgetProps = {}) {
  const [newThread, setNewThread] = useState(false);
  const [prompt, setPrompt] = useState(initialPrompt);
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
  const isBusy = isWorkspaceAgentV2DirectRunBusy(controller.status);
  const directRunDisabledReason = directRunDisabledReasonFor({
    isAdapterSupported,
    isBusy,
    prompt,
  });
  const directRunWarnings = useMemo(
    () =>
      uniqueWarnings([
        ...contextWarnings(contextItems),
        ...capabilityWarnings(runtimeAdapter, isAdapterSupported),
        ...controller.warnings,
      ]),
    [contextItems, controller.warnings, isAdapterSupported, runtimeAdapter],
  );
  const preflightItems = directRunPreflightItems({
    approvalPolicy,
    contextCount:
      visibleContextSnapshot?.contextRefs.length ?? contextItems?.length ?? 0,
    isAdapterSupported,
    sandbox,
    toolPolicyLabel:
      runtimeAdapter.capabilities.toolPolicy.allowedTools.length === 0
        ? "No Hobit tools allowed"
        : `${runtimeAdapter.capabilities.toolPolicy.allowedTools.length.toString()} tool(s) requested`,
    workingDirectory,
  });

  function handleDirectRun() {
    onRunRequest?.();
    void controller.startDirectRun(prompt);
  }

  return (
    <WidgetV2Shell
      status={{
        detail:
          "Experimental Workspace Agent v2. Direct Run uses the Codex adapter only when the host supplies runtime support.",
        label: isBusy ? "Running" : isAdapterSupported ? "Experimental" : "Unsupported",
        tone: isBusy ? "working" : isAdapterSupported ? "warning" : "error",
      }}
      subtitle="Experimental V2 conversation shell. Direct Run can start Codex when supported; Queue Run remains disabled."
      title={workspaceAgentV2Manifest?.title ?? "Workspace Agent v2"}
    >
      <WidgetV2Toolbar label="Workspace Agent v2 provider and mode row">
        <WorkspaceAgentV2TopBar />
      </WidgetV2Toolbar>
      <WidgetV2PanelLayout
        bottomDrawer={
          <WidgetV2BottomDrawer label="Workspace Agent v2 composer">
            <WorkspaceAgentV2ContextStrip
              items={contextItems}
              onAddPlaceholder={onContextAddPlaceholder}
              onRemoveItem={onContextRemove}
            />
            <WorkspaceAgentV2Composer
              directRunDisabled={Boolean(directRunDisabledReason)}
              directRunDisabledReason={directRunDisabledReason}
              directRunLabel={isBusy ? "Direct Run running" : "Direct Run"}
              errorMessage={controller.errorMessage}
              newThread={newThread}
              onDirectRun={handleDirectRun}
              onNewThreadChange={setNewThread}
              onPromptChange={setPrompt}
              onQueueRun={onQueueTaskCreate}
              preflightItems={preflightItems}
              prompt={prompt}
              queueRunDisabledReason={queueRunDisabledReason}
              warnings={directRunWarnings}
            />
          </WidgetV2BottomDrawer>
        }
        primary={
          <WorkspaceAgentV2Transcript
            emptyState={
              <>
                <h3>Transcript</h3>
                <p>
                  Visible conversation scaffold only. No hidden context is read.
                </p>
              </>
            }
            messages={controller.transcriptMessages}
          />
        }
        primaryLabel="Workspace Agent v2 transcript"
        rightInspector={
          <WidgetV2RightInspector label="Workspace Agent v2 activity pane">
            <WorkspaceAgentV2ActivityPane
              currentRunId={controller.currentRunId ?? currentRunId}
              events={controller.activityEvents}
            />
          </WidgetV2RightInspector>
        }
      />
    </WidgetV2Shell>
  );
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

function directRunPreflightItems({
  approvalPolicy,
  contextCount,
  isAdapterSupported,
  sandbox,
  toolPolicyLabel,
  workingDirectory,
}: {
  readonly approvalPolicy: DirectWorkApprovalPolicy;
  readonly contextCount: number;
  readonly isAdapterSupported: boolean;
  readonly sandbox: DirectWorkSandbox;
  readonly toolPolicyLabel: string;
  readonly workingDirectory?: string | null;
}): readonly WorkspaceAgentV2PreflightItem[] {
  return [
    { label: "Provider", value: "Codex" },
    { label: "Mode", value: "Direct Run" },
    {
      label: "Working directory",
      value: workingDirectory?.trim() || "Not configured",
    },
    { label: "Sandbox", value: sandbox },
    { label: "Tool policy", value: toolPolicyLabel },
    { label: "Approval policy", value: approvalPolicy },
    { label: "Context", value: `${contextCount.toString()} visible item(s)` },
    { label: "Adapter", value: isAdapterSupported ? "Supported" : "Unsupported" },
  ];
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
