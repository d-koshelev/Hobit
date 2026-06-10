import { useMemo, useState } from "react";

import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { DisabledActionReason } from "../design-system/ActionPrimitives";
import {
  RENDER_MEMORY_CAPS,
  cappedPreviewText,
} from "../renderMemoryGuards";
import type { AgentQueueTask } from "../workspace/types";
import type { QueueValidationRunResult } from "./queue/queueValidationEvidenceService";
import type { ValidationCommandResult, ValidationRunner } from "./validation";
import {
  buildWorkspaceChatValidationRunRequest,
  buildWorkspaceChatValidationSuiteDraft,
} from "./workspaceChatQueueValidation";
import {
  createWorkspaceChatQueueControlService,
  type WorkspaceChatQueueActionResult,
} from "./workspaceChatQueueControlService";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";

type WorkspaceChatValidationRunnerState =
  | "queued"
  | "running"
  | "passed"
  | "failed"
  | "unavailable"
  | null;

export function WorkspaceAgentQueueValidationCard({
  bridge,
  manualCommandInputSupported = true,
  onOpenQueueItem,
  runner,
  task,
}: {
  bridge?: WorkspaceAgentQueueBridge | null;
  manualCommandInputSupported?: boolean;
  onOpenQueueItem?: (queueItemId: string) => void;
  runner?: ValidationRunner | null;
  task: AgentQueueTask;
}) {
  const [manualCommand, setManualCommand] = useState("");
  const [runnerState, setRunnerState] =
    useState<WorkspaceChatValidationRunnerState>("queued");
  const [result, setResult] =
    useState<QueueValidationRunResult | null>(null);
  const [actionResult, setActionResult] =
    useState<WorkspaceChatQueueActionResult | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);
  const suiteDraft = useMemo(
    () =>
      buildWorkspaceChatValidationSuiteDraft({
        manualCommand,
        task,
      }),
    [manualCommand, task],
  );
  const runDisabledReason =
    !runner
      ? "Validation runner is unavailable in this Workspace Chat surface."
      : !bridge
        ? "Queue update bridge is unavailable, so validation evidence cannot be attached."
        : suiteDraft.commands.length === 0
          ? "Enter a validation command or use a Queue task with validation commands."
          : null;

  async function runValidation() {
    if (runDisabledReason || !runner) {
      setRunnerState("unavailable");
      setActionResult({
        action: "request_validation",
        message: runDisabledReason ?? "Validation is unavailable.",
        queueItemId: task.queueItemId,
        reason: runDisabledReason ?? "Validation is unavailable.",
        status: "unavailable",
      });
      return;
    }

    setRunnerState("running");
    setActionResult(null);
    setResult(null);
    setShowEvidence(false);

    const service = createWorkspaceChatQueueControlService({
      bridge,
      validationRunner: runner,
    });
    const nextResult = await service.execute({
      kind: "request_validation",
      request: buildWorkspaceChatValidationRunRequest({
        createdAt: new Date().toISOString(),
        manualCommand,
        runId: `workspace-chat-validation-${task.queueItemId}-${Date.now().toString()}`,
        task,
      }),
      queueItemId: task.queueItemId,
    });
    const validationResult = nextResult.validationResult ?? null;

    setActionResult(nextResult);
    setResult(validationResult);
    setRunnerState(
      validationResult?.runnerOutput.unavailable
        ? "unavailable"
        : validationResult?.runnerOutput.summary.status === "passed"
          ? "passed"
          : "failed",
    );
  }

  return (
    <section
      aria-label={`Queue validation request card: ${task.title}`}
      className="workspace-agent-queue-validation-card"
    >
      <div className="workspace-agent-queue-action-card-header">
        <div>
          <p className="coordinator-proposal-kicker">Queue validation</p>
          <h4 className="coordinator-proposal-title">{task.title}</h4>
        </div>
        <Badge variant={badgeVariantForRunnerState(runnerState)}>
          {runnerStateLabel(runnerState)}
        </Badge>
      </div>

      <dl className="workspace-agent-queue-action-card-facts">
        <ValidationFact label="Queue item" value={task.queueItemId} />
        <ValidationFact
          label="Suite"
          value={suiteDraft.suite.title}
        />
        <ValidationFact
          label="Commands"
          value={suiteDraft.commands.length.toString()}
        />
        <ValidationFact
          label="Workspace"
          value={task.executionWorkspace?.trim() || "Missing"}
        />
      </dl>

      {manualCommandInputSupported ? (
        <label className="workspace-agent-queue-action-field">
          <span>Manual validation command</span>
          <input
            aria-label="Manual validation command"
            className="input"
            onChange={(event) => setManualCommand(event.currentTarget.value)}
            placeholder="npm.cmd run typecheck --prefix apps/desktop/frontend"
            value={manualCommand}
          />
        </label>
      ) : null}

      <div
        aria-label="Selected validation commands"
        className="workspace-agent-queue-validation-command-list"
      >
        {suiteDraft.commands.length ? (
          suiteDraft.commands.map((command) => (
            <div key={command.id}>
              <span>{command.title}</span>
              <code>{command.executable ?? command.shellCommand}</code>
            </div>
          ))
        ) : (
          <p>No validation commands selected.</p>
        )}
      </div>

      {suiteDraft.warnings.length ? (
        <div className="workspace-agent-queue-task-status-warnings">
          {suiteDraft.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      <div className="workspace-agent-queue-validation-actions">
        <span className="workspace-agent-queue-task-status-action">
          <Button
            disabled={Boolean(runDisabledReason) || runnerState === "running"}
            onClick={() => void runValidation()}
            title={runDisabledReason ?? undefined}
            variant="primary"
          >
            {runnerState === "running" ? "Running validation" : "Run validation"}
          </Button>
          <DisabledActionReason reason={runDisabledReason} />
        </span>
        <Button
          disabled={!onOpenQueueItem}
          onClick={() => onOpenQueueItem?.(task.queueItemId)}
          title={onOpenQueueItem ? undefined : "Open Queue is unavailable."}
          variant="secondary"
        >
          Open Queue task
        </Button>
        <Button
          disabled={!result}
          onClick={() => setShowEvidence((current) => !current)}
          variant="secondary"
        >
          View evidence
        </Button>
      </div>

      {actionResult ? (
        <p
          className={`coordinator-proposal-result coordinator-proposal-result-${
            actionResult.status === "failed" ? "error" : "success"
          }`}
        >
          {cappedPreviewText(
            actionResult.message,
            RENDER_MEMORY_CAPS.transcriptPayloadChars,
          )}
        </p>
      ) : null}

      {result ? (
        <ValidationResultCard
          result={result}
          showEvidence={showEvidence}
        />
      ) : null}

      <p className="coordinator-proposal-note">
        Validation starts only from Run validation. This card does not finalize
        Queue tasks, start dependents, commit, push, or accept work.
      </p>
    </section>
  );
}

function ValidationResultCard({
  result,
  showEvidence,
}: {
  result: QueueValidationRunResult;
  showEvidence: boolean;
}) {
  const summary = result.runnerOutput.summary;
  const commands = result.runnerOutput.result.commandResults;

  return (
    <section
      aria-label="Validation result card"
      className="workspace-agent-queue-validation-result-card"
    >
      <div className="workspace-agent-queue-action-card-header">
        <div>
          <p className="coordinator-proposal-kicker">Validation result</p>
          <h4 className="coordinator-proposal-title">{summary.title}</h4>
        </div>
        <Badge variant={summary.status === "passed" ? "success" : "error"}>
          {result.runnerOutput.unavailable ? "Unavailable" : summary.status}
        </Badge>
      </div>

      <dl className="workspace-agent-queue-action-card-facts">
        <ValidationFact label="Status" value={summary.status} />
        <ValidationFact
          label="Command count"
          value={summary.commandCount.toString()}
        />
        <ValidationFact
          label="Passed"
          value={summary.passedCount.toString()}
        />
        <ValidationFact
          label="Failed"
          value={summary.failedCount.toString()}
        />
        <ValidationFact
          label="Duration"
          value={formatDuration(
            result.runnerOutput.result.durationMs ?? totalCommandDuration(commands),
          )}
        />
        <ValidationFact
          label="Exit codes"
          value={exitCodes(commands)}
        />
      </dl>

      {summary.warnings.length || summary.errors.length ? (
        <div className="workspace-agent-queue-task-status-warnings">
          {[...summary.errors, ...summary.warnings].map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      ) : null}

      {showEvidence ? (
        <div className="workspace-agent-queue-validation-evidence">
          {commands.map((command) => (
            <ValidationCommandEvidence
              command={command}
              key={command.commandId}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ValidationCommandEvidence({
  command,
}: {
  command: ValidationCommandResult;
}) {
  return (
    <section className="workspace-agent-queue-validation-command-evidence">
      <div className="workspace-agent-queue-action-card-header">
        <strong>{command.title}</strong>
        <Badge variant={command.status === "passed" ? "success" : "error"}>
          {command.status}
        </Badge>
      </div>
      <dl className="workspace-agent-queue-action-card-facts">
        <ValidationFact label="Exit" value={formatExitCode(command.exitCode)} />
        <ValidationFact label="Duration" value={formatDuration(command.durationMs)} />
      </dl>
      <ValidationOutputBlock label="stdout" preview={command.stdout.text} />
      <ValidationOutputBlock label="stderr" preview={command.stderr.text} />
      {command.stdout.truncated || command.stderr.truncated ? (
        <p className="coordinator-proposal-note">
          Output snippets are capped for Workspace Chat review.
        </p>
      ) : null}
      {command.warnings.length || command.errors.length ? (
        <div className="workspace-agent-queue-task-status-warnings">
          {[...command.errors, ...command.warnings].map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ValidationOutputBlock({
  label,
  preview,
}: {
  label: string;
  preview: string;
}) {
  return (
    <div className="workspace-agent-queue-validation-output">
      <p>{label}</p>
      <pre>
        {cappedPreviewText(
          preview || "empty",
          RENDER_MEMORY_CAPS.stdoutStderrPreviewChars,
        )}
      </pre>
    </div>
  );
}

function ValidationFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function runnerStateLabel(state: WorkspaceChatValidationRunnerState) {
  switch (state) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "passed":
      return "Passed";
    case "failed":
      return "Failed";
    case "unavailable":
      return "Unavailable";
    case null:
      return "Queued";
  }
}

function badgeVariantForRunnerState(
  state: WorkspaceChatValidationRunnerState,
) {
  switch (state) {
    case "passed":
      return "success" as const;
    case "failed":
    case "unavailable":
      return "error" as const;
    case "running":
      return "info" as const;
    case "queued":
    case null:
      return "neutral" as const;
  }
}

function formatDuration(durationMs: number | undefined) {
  return typeof durationMs === "number" ? `${durationMs.toString()} ms` : "n/a";
}

function totalCommandDuration(commands: ValidationCommandResult[]) {
  const durations = commands
    .map((command) => command.durationMs)
    .filter((duration): duration is number => typeof duration === "number");

  return durations.length ? durations.reduce((sum, duration) => sum + duration, 0) : undefined;
}

function exitCodes(commands: ValidationCommandResult[]) {
  if (!commands.length) {
    return "none";
  }

  return commands.map((command) => formatExitCode(command.exitCode)).join(", ");
}

function formatExitCode(exitCode: number | null | undefined) {
  return typeof exitCode === "number" ? exitCode.toString() : "none";
}
