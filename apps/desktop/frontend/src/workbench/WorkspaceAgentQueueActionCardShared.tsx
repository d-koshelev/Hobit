import type {
  AgentQueueTaskExecutionPolicy,
  AgentQueueTaskStatus,
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
} from "../workspace/types";
import {
  RENDER_MEMORY_CAPS,
  cappedPreviewText,
} from "../renderMemoryGuards";
import type { WorkspaceAgentQueueIntentDraft } from "./workspaceAgentQueueIntent";

export const EXECUTION_POLICY_OPTIONS: AgentQueueTaskExecutionPolicy[] = [
  "manual",
  "auto",
  "after_previous_success",
];

export const CREATE_STATUS_OPTIONS: Array<
  Extract<AgentQueueTaskStatus, "draft" | "queued">
> = ["draft", "queued"];

export const UPDATE_STATUS_OPTIONS: AgentQueueTaskStatus[] = [
  "draft",
  "queued",
  "ready",
  "running",
  "completed",
  "failed",
  "cancelled",
  "review_needed",
];

export const SANDBOX_OPTIONS: DirectWorkSandbox[] = [
  "read_only",
  "workspace_write",
  "danger_full_access",
];

export const APPROVAL_POLICY_OPTIONS: DirectWorkApprovalPolicy[] = [
  "never",
  "on_request",
  "untrusted",
];

export function QueueRunSettingFields({
  draft,
  onPatchDraft,
}: {
  draft: WorkspaceAgentQueueIntentDraft;
  onPatchDraft: (patch: Partial<WorkspaceAgentQueueIntentDraft>) => void;
}) {
  return (
    <>
      <QueueTextInput
        label="Execution workspace"
        onChange={(executionWorkspace) => onPatchDraft({ executionWorkspace })}
        value={draft.executionWorkspace}
      />
      <QueueTextInput
        label="Codex executable"
        onChange={(codexExecutable) => onPatchDraft({ codexExecutable })}
        value={draft.codexExecutable}
      />
      <QueueSelect
        allowBlank
        label="Sandbox"
        onChange={(sandbox) =>
          onPatchDraft({
            sandbox: sandbox as WorkspaceAgentQueueIntentDraft["sandbox"],
          })
        }
        options={SANDBOX_OPTIONS}
        value={draft.sandbox}
      />
      <QueueSelect
        allowBlank
        label="Approval policy"
        onChange={(approvalPolicy) =>
          onPatchDraft({
            approvalPolicy:
              approvalPolicy as WorkspaceAgentQueueIntentDraft["approvalPolicy"],
          })
        }
        options={APPROVAL_POLICY_OPTIONS}
        value={draft.approvalPolicy}
      />
    </>
  );
}

export function QueueTextInput({
  label,
  onChange,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  type?: "number" | "text";
  value: string;
}) {
  return (
    <label className="workspace-agent-queue-action-field">
      <span>{label}</span>
      <input
        aria-label={label}
        className="input"
        onChange={(event) => onChange(event.currentTarget.value)}
        type={type}
        value={value}
      />
    </label>
  );
}

export function QueueTextarea({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="workspace-agent-queue-action-field">
      <span>{label}</span>
      <textarea
        aria-label={label}
        className="input workspace-agent-queue-action-textarea"
        onChange={(event) => onChange(event.currentTarget.value)}
        rows={2}
        value={value}
      />
    </label>
  );
}

export function QueueSelect({
  allowBlank = false,
  label,
  onChange,
  options,
  value,
}: {
  allowBlank?: boolean;
  label: string;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <label className="workspace-agent-queue-action-field">
      <span>{label}</span>
      <select
        aria-label={label}
        className="input"
        onChange={(event) => onChange(event.currentTarget.value)}
        value={value}
      >
        {allowBlank ? <option value="">Preserve</option> : null}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ActionFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {cappedPreviewText(value, RENDER_MEMORY_CAPS.transcriptPayloadChars)}
      </dd>
    </div>
  );
}
