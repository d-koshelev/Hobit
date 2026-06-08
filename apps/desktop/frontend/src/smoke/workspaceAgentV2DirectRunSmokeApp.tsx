import React from "react";
import ReactDOM from "react-dom/client";

import "../styles/hobit-theme.css";
import "../styles/tokens.css";
import "../styles/theme.css";
import "../styles/layout.css";
import "../styles/widget-v2.css";
import "../styles/widget-v2-workspace-agent.css";

import type {
  AgentRunEvent,
  AgentRunRequest,
  AgentRunResult,
  CodexAgentRuntimeAdapter,
  CodexAgentRuntimeLaunchOptions,
} from "../workbench/agentRuntime";
import { createCodexProviderCapabilities } from "../workbench/agentRuntime";
import { WorkspaceAgentV2Widget } from "../workbench/widgetV2/workspaceAgentV2";
import {
  WORKSPACE_AGENT_V2_EXPERIMENTAL_ENTRY,
  workspaceAgentV2ExperimentalAccessSummary,
} from "../workbench/widgetV2/workspaceAgentV2/workspaceAgentV2ExperimentalAccess";

type WorkspaceAgentV2SmokeSnapshot = {
  readonly entryLabel: string;
  readonly mode: string;
  readonly openedRunCount: number;
  readonly route: string;
  readonly status: string;
};

type WorkspaceAgentV2SmokeApi = {
  readonly accessSummary: string;
  readonly snapshot: () => WorkspaceAgentV2SmokeSnapshot;
};

declare global {
  interface Window {
    __HOBIT_WORKSPACE_AGENT_V2_SMOKE__?: WorkspaceAgentV2SmokeApi;
  }
}

const WORKSPACE_ID = "workspace-agent-v2-direct-run-smoke";
const WIDGET_INSTANCE_ID = "workspace-agent-v2-direct-run-smoke-widget";

class WorkspaceAgentV2SmokeRuntime {
  private openedRunCount = 0;

  adapter(): CodexAgentRuntimeAdapter {
    return {
      capabilities: createCodexProviderCapabilities({
        supportsCancellation: false,
      }),
      cancelRun: async () => ({
        supported: false,
        warnings: ["Cancellation is unavailable in this dev smoke adapter."],
      }),
      startRun: async (
        request: AgentRunRequest,
        _options: CodexAgentRuntimeLaunchOptions,
        onEvent: (event: AgentRunEvent) => void,
        _signal?: AbortSignal,
        onResult?: (result: AgentRunResult) => void,
      ) => {
        this.openedRunCount += 1;
        const runId = `workspace-agent-v2-smoke-run-${this.openedRunCount.toString()}`;
        const timestampMs = Date.now();

        onEvent({
          id: `${runId}:started`,
          kind: "provider_started",
          lifecycle: "starting",
          message: "Codex Direct Run smoke adapter accepted the visible prompt.",
          runId,
          sequence: 1,
          timestampMs,
          title: "Codex Direct Run started",
        });
        onEvent({
          id: `${runId}:response`,
          kind: "response_received",
          lifecycle: "running",
          message: `Visible prompt: ${request.prompt}`,
          runId,
          sequence: 2,
          timestampMs: timestampMs + 1,
          title: "Codex Direct Run activity",
        });

        onResult?.({
          assistantText:
            "Workspace Agent v2 Direct Run smoke completed. No files were read or changed.",
          fileChanges: [],
          lifecycle: "completed",
          metadata: {
            completedAtMs: timestampMs + 2,
            durationMs: 2,
            lifecycle: "completed",
            mode: "direct",
            providerId: request.providerId,
            runId,
            startedAtMs: timestampMs,
            tokenUsage: null,
            workspaceId: request.workspaceId,
          },
          runId,
          validationSuggestions: [],
          warnings: [
            "Dev smoke adapter only; use desktop Workspace Agent Direct Work for real Codex execution.",
          ],
        });

        return {
          runId,
          stopListening: () => undefined,
          warnings: [],
        };
      },
    };
  }

  snapshot(): WorkspaceAgentV2SmokeSnapshot {
    return {
      entryLabel: WORKSPACE_AGENT_V2_EXPERIMENTAL_ENTRY.label,
      mode: WORKSPACE_AGENT_V2_EXPERIMENTAL_ENTRY.mode,
      openedRunCount: this.openedRunCount,
      route: WORKSPACE_AGENT_V2_EXPERIMENTAL_ENTRY.route,
      status: WORKSPACE_AGENT_V2_EXPERIMENTAL_ENTRY.status,
    };
  }
}

function WorkspaceAgentV2DirectRunSmokeApp() {
  const runtime = React.useMemo(() => new WorkspaceAgentV2SmokeRuntime(), []);

  React.useEffect(() => {
    window.__HOBIT_WORKSPACE_AGENT_V2_SMOKE__ = {
      accessSummary: workspaceAgentV2ExperimentalAccessSummary(),
      snapshot: () => runtime.snapshot(),
    };

    return () => {
      delete window.__HOBIT_WORKSPACE_AGENT_V2_SMOKE__;
    };
  }, [runtime]);

  return (
    <main className="app-shell">
      <div className="workbench">
        <div className="workbench-content">
          <section
            aria-label="Workspace Agent v2 Direct Run experimental smoke"
            className="canvas-shell"
          >
            <div className="canvas-stack">
              <div className="widget-layout-surface">
                <WorkspaceAgentV2Widget
                  adapter={runtime.adapter()}
                  directRunSupported
                  initialPrompt=""
                  widgetInstanceId={WIDGET_INSTANCE_ID}
                  workingDirectory="."
                  workspaceId={WORKSPACE_ID}
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <WorkspaceAgentV2DirectRunSmokeApp />,
);
