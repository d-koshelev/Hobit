import { useId, useState } from "react";

import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { Input } from "../design-system/Input";
import type {
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
} from "../workspace/types";
import { CodexDirectWorkAdvancedSettings } from "./CodexDirectWorkAdvancedSettings";
import {
  CodexDirectWorkActionSafetyCopy,
  CodexDirectWorkPromptGuidance,
  CodexDirectWorkWorkspaceWriteWarning,
} from "./CodexDirectWorkSafetyNotice";
import type { CodexDirectWorkRequestDraft } from "./CodexDirectWorkTypes";

const DEFAULT_CODEX_EXECUTABLE = "codex";
const WINDOWS_CODEX_EXECUTABLE = "codex.cmd";

type CodexDirectWorkFormProps = {
  canRunBackend: boolean;
  isRunning: boolean;
  onSubmit: (request: CodexDirectWorkRequestDraft) => void;
  onValidationError: (message: string) => void;
};

export function CodexDirectWorkForm({
  canRunBackend,
  isRunning,
  onSubmit,
  onValidationError,
}: CodexDirectWorkFormProps) {
  const repoInputId = useId();
  const promptInputId = useId();
  const sandboxInputId = useId();
  const approvalInputId = useId();
  const codexExecutableInputId = useId();
  const timeoutInputId = useId();
  const stdoutCapInputId = useId();
  const stderrCapInputId = useId();

  const [codexExecutableDraft, setCodexExecutableDraft] = useState(defaultCodexExecutable);
  const [repoRootDraft, setRepoRootDraft] = useState("");
  const [operatorPromptDraft, setOperatorPromptDraft] = useState("");
  const [sandbox, setSandbox] = useState<DirectWorkSandbox>("read_only");
  const [approvalPolicy, setApprovalPolicy] = useState<DirectWorkApprovalPolicy>("never");
  const [timeoutMsDraft, setTimeoutMsDraft] = useState("");
  const [stdoutCapBytesDraft, setStdoutCapBytesDraft] = useState("");
  const [stderrCapBytesDraft, setStderrCapBytesDraft] = useState("");

  const codexExecutable = codexExecutableDraft.trim();
  const repoRoot = repoRootDraft.trim();
  const operatorPrompt = operatorPromptDraft.trim();
  const timeoutMsError = positiveIntegerInputError(timeoutMsDraft, "Timeout ms");
  const stdoutCapBytesError = positiveIntegerInputError(
    stdoutCapBytesDraft,
    "Stdout cap bytes",
  );
  const stderrCapBytesError = positiveIntegerInputError(
    stderrCapBytesDraft,
    "Stderr cap bytes",
  );
  const numericInputError = timeoutMsError ?? stdoutCapBytesError ?? stderrCapBytesError;
  const promptWarningMessage = directWorkPromptWarning(operatorPromptDraft);
  const canRun =
    canRunBackend &&
    codexExecutable.length > 0 &&
    repoRoot.length > 0 &&
    operatorPrompt.length > 0 &&
    !numericInputError &&
    !isRunning;

  function submitDirectWork() {
    if (!codexExecutable || !repoRoot || !operatorPrompt) {
      onValidationError(
        "Codex Direct Work requires a Codex executable, repository root, and operator prompt.",
      );
      return;
    }

    if (numericInputError) {
      onValidationError(numericInputError);
      return;
    }

    onSubmit({
      codexExecutable,
      repoRoot,
      operatorPrompt,
      sandbox,
      approvalPolicy,
      timeoutMs: parsePositiveIntegerInput(timeoutMsDraft, "Timeout ms"),
      stdoutCapBytes: parsePositiveIntegerInput(
        stdoutCapBytesDraft,
        "Stdout cap bytes",
      ),
      stderrCapBytes: parsePositiveIntegerInput(
        stderrCapBytesDraft,
        "Stderr cap bytes",
      ),
    });
  }

  return (
    <section
      aria-label="Direct Work run setup"
      className="codex-direct-work-run-setup"
    >
      <div className="codex-direct-work-section-header">
        <div className="codex-direct-work-copy">
          <h3 className="codex-direct-work-title">Codex Direct Work setup</h3>
          <p className="codex-direct-work-text">
            This execution mode runs Codex CLI inside an explicit repository
            boundary. Generic task planning belongs in Agent Queue.
          </p>
        </div>
        <Badge variant="neutral">Direct Work</Badge>
      </div>

      <div className="codex-direct-work-controls">
        <div className="codex-direct-work-field codex-direct-work-field-wide">
          <label className="codex-direct-work-label" htmlFor={repoInputId}>
            Repo root
          </label>
          <Input
            autoComplete="off"
            id={repoInputId}
            onChange={(event) => setRepoRootDraft(event.target.value)}
            placeholder="C:\\path\\to\\repo"
            spellCheck={false}
            type="text"
            value={repoRootDraft}
          />
          <p className="codex-direct-work-note">
            Required for Codex Direct Work because the current executor is
            repository-scoped.
          </p>
        </div>

        <div className="codex-direct-work-field codex-direct-work-field-wide">
          <label className="codex-direct-work-label" htmlFor={promptInputId}>
            Operator prompt
          </label>
          <textarea
            className="input codex-direct-work-prompt"
            id={promptInputId}
            onChange={(event) => setOperatorPromptDraft(event.target.value)}
            placeholder="Describe the focused repository task for Codex."
            spellCheck={true}
            value={operatorPromptDraft}
          />
          <CodexDirectWorkPromptGuidance promptWarningMessage={promptWarningMessage} />
        </div>

        <div className="codex-direct-work-field">
          <label className="codex-direct-work-label" htmlFor={sandboxInputId}>
            Sandbox
          </label>
          <select
            className="input"
            id={sandboxInputId}
            onChange={(event) => setSandbox(event.target.value as DirectWorkSandbox)}
            value={sandbox}
          >
            <option value="read_only">read_only</option>
            <option value="workspace_write">workspace_write</option>
          </select>
        </div>

        <div className="codex-direct-work-field">
          <label className="codex-direct-work-label" htmlFor={approvalInputId}>
            Approval policy
          </label>
          <select
            className="input"
            id={approvalInputId}
            onChange={(event) =>
              setApprovalPolicy(event.target.value as DirectWorkApprovalPolicy)
            }
            value={approvalPolicy}
          >
            <option value="never">never (recommended)</option>
            <option value="on_request">on_request (advanced, interactive-sensitive)</option>
            <option value="untrusted">untrusted</option>
          </select>
          <p className="codex-direct-work-note">
            For one-shot non-interactive runs, never is recommended.
          </p>
        </div>

        {sandbox === "workspace_write" ? <CodexDirectWorkWorkspaceWriteWarning /> : null}

        <CodexDirectWorkAdvancedSettings
          codexExecutableInputId={codexExecutableInputId}
          codexExecutableDraft={codexExecutableDraft}
          onCodexExecutableDraftChange={setCodexExecutableDraft}
          timeoutInputId={timeoutInputId}
          timeoutMsDraft={timeoutMsDraft}
          onTimeoutMsDraftChange={setTimeoutMsDraft}
          timeoutMsError={timeoutMsError}
          stdoutCapInputId={stdoutCapInputId}
          stdoutCapBytesDraft={stdoutCapBytesDraft}
          onStdoutCapBytesDraftChange={setStdoutCapBytesDraft}
          stdoutCapBytesError={stdoutCapBytesError}
          stderrCapInputId={stderrCapInputId}
          stderrCapBytesDraft={stderrCapBytesDraft}
          onStderrCapBytesDraftChange={setStderrCapBytesDraft}
          stderrCapBytesError={stderrCapBytesError}
        />

        {numericInputError ? (
          <p className="codex-direct-work-validation" role="alert">
            {numericInputError}
          </p>
        ) : null}
      </div>

      <div className="codex-direct-work-action-row">
        <Button disabled={!canRun} onClick={submitDirectWork} variant="primary">
          {isRunning ? "Running..." : "Run Codex Direct Work"}
        </Button>
        <CodexDirectWorkActionSafetyCopy />
      </div>
    </section>
  );
}

function directWorkPromptWarning(prompt: string): string | null {
  if (/(git\s+widget|agent\s+monitoring|hobit\s+ui)/i.test(prompt)) {
    return "Codex cannot operate Hobit UI widgets. Use repository-oriented prompts instead.";
  }

  return null;
}

function parsePositiveIntegerInput(value: string, label: string): number | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const errorMessage = positiveIntegerInputError(value, label);

  if (errorMessage) {
    throw new Error(errorMessage);
  }

  return Number(trimmedValue);
}

function positiveIntegerInputError(value: string, label: string): string | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const parsedValue = Number(trimmedValue);

  if (!Number.isSafeInteger(parsedValue) || parsedValue <= 0) {
    return `${label} must be a positive integer.`;
  }

  return null;
}

function defaultCodexExecutable(): string {
  if (typeof navigator === "undefined") {
    return DEFAULT_CODEX_EXECUTABLE;
  }

  const platformText = `${navigator.userAgent} ${navigator.platform}`;
  return /(Windows|Win32|Win64|WOW64)/i.test(platformText)
    ? WINDOWS_CODEX_EXECUTABLE
    : DEFAULT_CODEX_EXECUTABLE;
}
