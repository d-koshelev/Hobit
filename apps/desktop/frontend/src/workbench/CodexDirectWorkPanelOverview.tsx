import { Badge } from "../design-system/Badge";
import type { RunCodexDirectWorkResponse } from "../workspace/types";
import type { CodexDirectWorkLiveRun } from "./CodexDirectWorkLiveLog";
import type { WidgetInstanceId } from "./types";

type BadgeVariant = "neutral" | "info" | "success" | "warning" | "error";

type CodexDirectWorkPanelOverviewProps = {
  canRunBackend: boolean;
  isRunning: boolean;
  liveRun: CodexDirectWorkLiveRun | null;
  runErrorMessage: string | null;
  runResult: RunCodexDirectWorkResponse | null;
  widgetInstanceId: WidgetInstanceId;
};

export function CodexDirectWorkPanelOverview({
  canRunBackend,
  isRunning,
  liveRun,
  runErrorMessage,
  runResult,
  widgetInstanceId,
}: CodexDirectWorkPanelOverviewProps) {
  const statusView = directWorkPanelStatusView({
    canRunBackend,
    isRunning,
    liveRun,
    runErrorMessage,
    runResult,
    widgetInstanceId,
  });
  const slotIdentity = `Agent Executor ${shortWidgetInstanceId(widgetInstanceId)}`;

  return (
    <section
      aria-label="Agent Executor overview"
      className="codex-direct-work-overview"
    >
      <div className="codex-direct-work-section-header">
        <div className="codex-direct-work-copy">
          <h3 className="codex-direct-work-title">Agent Executor</h3>
          <p className="codex-direct-work-text">
            Runs one operator-approved task through the local executor boundary.
            This widget is an execution slot; future Queue assignment can target
            this slot.
          </p>
        </div>
        <Badge variant={statusView.badgeVariant}>{statusView.badgeLabel}</Badge>
      </div>

      <dl className="codex-direct-work-overview-grid">
        <OverviewField label="Role" value="Execution surface" />
        <OverviewField label="Provider" value="Codex CLI" />
        <OverviewField label="Mode" value="Direct Work" />
        <OverviewField label="Current status" value={statusView.description} />
        <OverviewField label="Slot" value={slotIdentity} />
      </dl>
    </section>
  );
}

function OverviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="codex-direct-work-overview-field">
      <dt className="codex-direct-work-result-label">{label}</dt>
      <dd className="codex-direct-work-result-value">{value}</dd>
    </div>
  );
}

function directWorkPanelStatusView({
  canRunBackend,
  isRunning,
  liveRun,
  runErrorMessage,
  runResult,
}: CodexDirectWorkPanelOverviewProps): {
  badgeLabel: string;
  badgeVariant: BadgeVariant;
  description: string;
} {
  if (!canRunBackend) {
    return {
      badgeLabel: "Status unknown",
      badgeVariant: "neutral",
      description: "Backend execution is unavailable in this runtime.",
    };
  }

  if (isRunning) {
    return {
      badgeLabel: "Running",
      badgeVariant: "info",
      description: "Codex Direct Work is running.",
    };
  }

  const finalStatus = liveRun?.status ?? runResult?.status ?? null;
  const exitCode = runResult?.exitCode ?? liveRun?.exitCode ?? null;

  if (finalStatus === "completed") {
    return {
      badgeLabel: exitCode === 0 ? "Completed" : "Attention needed",
      badgeVariant: exitCode === 0 ? "success" : "warning",
      description:
        exitCode === 0
          ? "Last run completed successfully."
          : "Last run completed with review needed.",
    };
  }

  if (finalStatus === "cancelled") {
    return {
      badgeLabel: "Cancelled",
      badgeVariant: "warning",
      description: "Last run was cancelled.",
    };
  }

  if (finalStatus === "timed_out") {
    return {
      badgeLabel: "Attention needed",
      badgeVariant: "warning",
      description: "Last run timed out.",
    };
  }

  if (finalStatus === "failed" || runErrorMessage) {
    return {
      badgeLabel: "Failed",
      badgeVariant: "error",
      description: "Last request failed or could not start.",
    };
  }

  return {
    badgeLabel: "Idle",
    badgeVariant: "neutral",
    description: "Ready for one explicit Direct Work task.",
  };
}

function shortWidgetInstanceId(widgetInstanceId: WidgetInstanceId) {
  const compactId = widgetInstanceId.replace(/[^a-z0-9]/gi, "");

  return compactId.slice(-6) || widgetInstanceId.slice(-6) || "unknown";
}
