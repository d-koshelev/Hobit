import type {
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
} from "../../../workspace/types";
import type {
  QueueValidationRunResult,
} from "../../queue/queueValidationEvidenceService";
import type { ValidationRunner } from "../../validation";
import type {
  QueuePromptPackImportMetadata,
} from "../../promptPack/queuePromptPackMetadata";
import {
  queueV2ValidationEvidenceView,
  type QueueV2ValidationCommandEvidence,
} from "./queueV2ValidationEvidence";

export type QueueV2ValidationRequestState =
  | "idle"
  | "running"
  | "passed"
  | "failed"
  | "unavailable";

export function QueueV2FilesValidationSection({
  latestReport,
  promptPackMetadata,
  task,
  validationEvidence,
  validationRequestMessage,
  validationRequestState,
}: {
  latestReport: AgentQueueWorkerExecutionReport | null;
  promptPackMetadata: QueuePromptPackImportMetadata | null;
  task: AgentQueueTask;
  validationEvidence: ReturnType<typeof queueV2ValidationEvidenceView> | null;
  validationRequestMessage: string | null;
  validationRequestState: QueueV2ValidationRequestState;
}) {
  const commands =
    validationEvidence?.commands.length
      ? validationEvidence.commands
      : fallbackValidationCommands({
          latestReport,
          promptPackMetadata,
        });

  return (
    <div className="queue-v2-task-details-section">
      <CompactList
        emptyLabel="No changed files reported."
        items={latestReport?.changedFiles ?? []}
        label="Changed files"
      />
      <ValidationEvidenceSummary
        evidenceAt={validationEvidence?.evidenceAt ?? null}
        requestMessage={validationRequestMessage}
        requestState={validationRequestState}
        state={validationEvidence?.state ?? "not_requested"}
        summary={validationEvidence?.summary ?? validationSummary(task, latestReport)}
        warnings={validationEvidence?.warnings ?? []}
      />
      <div className="queue-v2-task-details-block">
        <h3>Validation commands</h3>
        {commands.length ? (
          <div className="queue-v2-validation-command-list">
            {commands.map((command, index) =>
              typeof command === "string" ? (
                <p key={command}>{command}</p>
              ) : (
                <ValidationCommandEvidence
                  command={command}
                  key={`${command.command}-${index.toString()}`}
                />
              ),
            )}
          </div>
        ) : (
          <p>No validation commands were run.</p>
        )}
      </div>
      {promptPackMetadata?.expectedCommitTitle ? (
        <DetailBlock
          label="Expected commit title"
          value={promptPackMetadata.expectedCommitTitle}
        />
      ) : null}
    </div>
  );
}

export function validationRequestDisabledReason({
  onRequestValidation,
  task,
  validationRunner,
}: {
  onRequestValidation?: (
    task: AgentQueueTask,
    runner: ValidationRunner,
  ) => Promise<QueueValidationRunResult>;
  task: AgentQueueTask | null;
  validationRunner?: ValidationRunner | null;
}) {
  if (!validationRunner) {
    return "Validation runner is unavailable for this Queue surface.";
  }

  if (!onRequestValidation) {
    return "Queue validation request action is not wired in this surface.";
  }

  if (!task?.executionWorkspace?.trim()) {
    return "Validation needs an execution workspace on the Queue task.";
  }

  return null;
}

function ValidationEvidenceSummary({
  evidenceAt,
  requestMessage,
  requestState,
  state,
  summary,
  warnings,
}: {
  evidenceAt: string | null;
  requestMessage: string | null;
  requestState: QueueV2ValidationRequestState;
  state: ReturnType<typeof queueV2ValidationEvidenceView>["state"];
  summary: string;
  warnings: readonly string[];
}) {
  return (
    <div className="queue-v2-task-details-block">
      <h3>Validation evidence</h3>
      <dl className="queue-v2-task-details-facts">
        <DetailFact label="State" value={stateLabel(state)} />
        <DetailFact label="Evidence timestamp" value={evidenceAt ?? "None"} />
        <DetailFact label="Request" value={requestStateLabel(requestState)} />
        <DetailFact label="Warnings / errors" value={warnings.length.toString()} />
      </dl>
      <p>{summary}</p>
      {requestMessage ? <p>{requestMessage}</p> : null}
      {warnings.length ? (
        <ul>
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ValidationCommandEvidence({
  command,
}: {
  command: QueueV2ValidationCommandEvidence;
}) {
  return (
    <section className="queue-v2-validation-command-evidence">
      <div className="queue-v2-validation-command-header">
        <strong>{command.command}</strong>
        <span>{command.status}</span>
      </div>
      <dl className="queue-v2-task-details-facts">
        <DetailFact label="Exit" value={command.exit} />
        <DetailFact label="Duration" value={command.duration} />
      </dl>
      <ValidationOutputBlock label="stdout snippet" value={command.stdout} />
      <ValidationOutputBlock label="stderr snippet" value={command.stderr} />
      {command.warnings.length || command.errors.length ? (
        <ul>
          {[...command.errors, ...command.warnings].map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function ValidationOutputBlock({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="queue-v2-validation-output">
      <p>{label}</p>
      <pre>{value}</pre>
    </div>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="queue-v2-task-details-block">
      <h3>{label}</h3>
      <p>{value}</p>
    </div>
  );
}

function DetailFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function CompactList({
  emptyLabel,
  items,
  label,
}: {
  emptyLabel: string;
  items: readonly string[];
  label: string;
}) {
  return (
    <div className="queue-v2-task-details-block">
      <h3>{label}</h3>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>{emptyLabel}</p>
      )}
    </div>
  );
}

function validationSummary(
  task: AgentQueueTask,
  latestReport: AgentQueueWorkerExecutionReport | null,
) {
  return latestReport?.validationResult ?? task.validationStatus ?? "not_started";
}

function fallbackValidationCommands({
  latestReport,
  promptPackMetadata,
}: {
  latestReport: AgentQueueWorkerExecutionReport | null;
  promptPackMetadata: QueuePromptPackImportMetadata | null;
}) {
  return promptPackMetadata?.validationCommands.length
    ? promptPackMetadata.validationCommands
    : latestReport?.validationCommandsRun ?? latestReport?.commandsRun ?? [];
}

function stateLabel(
  state: ReturnType<typeof queueV2ValidationEvidenceView>["state"],
) {
  switch (state) {
    case "not_requested":
      return "Not requested";
    case "running":
      return "Running";
    case "passed":
      return "Passed";
    case "failed":
      return "Failed";
    case "unavailable":
      return "Unavailable";
    case "cancelled":
      return "Cancelled";
    case "stale":
      return "Stale";
  }
}

function requestStateLabel(state: QueueV2ValidationRequestState) {
  switch (state) {
    case "idle":
      return "Not requested in this view";
    case "running":
      return "Request running";
    case "passed":
      return "Request completed";
    case "failed":
      return "Request failed";
    case "unavailable":
      return "Request unavailable";
  }
}
