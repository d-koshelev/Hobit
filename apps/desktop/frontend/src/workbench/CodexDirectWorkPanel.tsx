import { useId, useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { Input } from "../design-system/Input";
import type {
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
  RunCodexDirectWorkRequest,
  RunCodexDirectWorkResponse,
} from "../workspace/types";
import { StaticPreviewFieldList } from "./StaticPreviewPrimitives";
import type { WidgetInstanceId } from "./types";

const OUTPUT_PREVIEW_LIMIT = 4000;

type CodexDirectWorkPanelProps = {
  onRunCodexDirectWork?: (
    widgetInstanceId: WidgetInstanceId,
    request: Omit<
      RunCodexDirectWorkRequest,
      "workspaceId" | "workbenchId" | "widgetInstanceId"
    >,
  ) => Promise<RunCodexDirectWorkResponse | null>;
  widgetInstanceId: WidgetInstanceId;
};

export function CodexDirectWorkPanel({
  onRunCodexDirectWork,
  widgetInstanceId,
}: CodexDirectWorkPanelProps) {
  const repoRootInputId = useId();
  const promptInputId = useId();
  const sandboxInputId = useId();
  const approvalPolicyInputId = useId();
  const codexExecutableInputId = useId();
  const timeoutInputId = useId();
  const stdoutCapInputId = useId();
  const stderrCapInputId = useId();
  const panelTitleId = useId();
  const [codexExecutableDraft, setCodexExecutableDraft] = useState("codex");
  const [repoRootDraft, setRepoRootDraft] = useState("");
  const [operatorPromptDraft, setOperatorPromptDraft] = useState("");
  const [sandbox, setSandbox] = useState<DirectWorkSandbox>("read_only");
  const [approvalPolicy, setApprovalPolicy] =
    useState<DirectWorkApprovalPolicy>("on_request");
  const [timeoutMsDraft, setTimeoutMsDraft] = useState("");
  const [stdoutCapBytesDraft, setStdoutCapBytesDraft] = useState("");
  const [stderrCapBytesDraft, setStderrCapBytesDraft] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [runErrorMessage, setRunErrorMessage] = useState<string | null>(null);
  const [runResult, setRunResult] =
    useState<RunCodexDirectWorkResponse | null>(null);
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
  const numericInputError =
    timeoutMsError ?? stdoutCapBytesError ?? stderrCapBytesError;
  const canRun =
    Boolean(onRunCodexDirectWork) &&
    codexExecutable.length > 0 &&
    repoRoot.length > 0 &&
    operatorPrompt.length > 0 &&
    !numericInputError &&
    !isRunning;

  async function runDirectWork() {
    if (!onRunCodexDirectWork || isRunning) {
      return;
    }

    setRunErrorMessage(null);
    setRunResult(null);

    if (!codexExecutable || !repoRoot || !operatorPrompt) {
      setRunErrorMessage(
        "Codex executable, repository root, and operator prompt are required.",
      );
      return;
    }

    if (numericInputError) {
      setRunErrorMessage(numericInputError);
      return;
    }

    setIsRunning(true);

    try {
      const response = await onRunCodexDirectWork(widgetInstanceId, {
        approvalPolicy,
        codexExecutable,
        operatorPrompt,
        repoRoot,
        sandbox,
        stderrCapBytes: parsePositiveIntegerInput(
          stderrCapBytesDraft,
          "Stderr cap bytes",
        ),
        stdoutCapBytes: parsePositiveIntegerInput(
          stdoutCapBytesDraft,
          "Stdout cap bytes",
        ),
        timeoutMs: parsePositiveIntegerInput(timeoutMsDraft, "Timeout ms"),
      });

      if (!response) {
        throw new Error(
          "Codex Direct Work was not accepted for this widget instance.",
        );
      }

      setRunResult(response);
    } catch (error) {
      setRunErrorMessage(errorToMessage(error));
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <section
      aria-labelledby={panelTitleId}
      className="codex-direct-work-panel"
    >
      <div className="codex-direct-work-header">
        <div className="codex-direct-work-copy">
          <h3 className="codex-direct-work-title" id={panelTitleId}>
            Codex Direct Work
          </h3>
          <p className="codex-direct-work-text">
            Run Codex on a focused task. Codex may edit files when
            workspace-write is selected. No commit or push will be created
            automatically.
          </p>
        </div>
        <Badge variant="info">One-shot</Badge>
      </div>

      <div className="codex-direct-work-controls">
        <div className="codex-direct-work-field codex-direct-work-field-wide">
          <label className="codex-direct-work-label" htmlFor={repoRootInputId}>
            Repo root
          </label>
          <Input
            autoComplete="off"
            id={repoRootInputId}
            onChange={(event) => setRepoRootDraft(event.target.value)}
            placeholder="C:\\path\\to\\repo"
            spellCheck={false}
            type="text"
            value={repoRootDraft}
          />
        </div>

        <div className="codex-direct-work-field codex-direct-work-field-wide">
          <label className="codex-direct-work-label" htmlFor={promptInputId}>
            Operator prompt
          </label>
          <textarea
            className="input codex-direct-work-prompt"
            id={promptInputId}
            onChange={(event) => setOperatorPromptDraft(event.target.value)}
            placeholder="Describe the focused task for Codex."
            spellCheck={true}
            value={operatorPromptDraft}
          />
        </div>

        <div className="codex-direct-work-field">
          <label className="codex-direct-work-label" htmlFor={sandboxInputId}>
            Sandbox
          </label>
          <select
            className="input"
            id={sandboxInputId}
            onChange={(event) =>
              setSandbox(event.target.value as DirectWorkSandbox)
            }
            value={sandbox}
          >
            <option value="read_only">read_only</option>
            <option value="workspace_write">workspace_write</option>
          </select>
        </div>

        <div className="codex-direct-work-field">
          <label
            className="codex-direct-work-label"
            htmlFor={approvalPolicyInputId}
          >
            Approval policy
          </label>
          <select
            className="input"
            id={approvalPolicyInputId}
            onChange={(event) =>
              setApprovalPolicy(event.target.value as DirectWorkApprovalPolicy)
            }
            value={approvalPolicy}
          >
            <option value="on_request">on_request</option>
            <option value="never">never</option>
            <option value="untrusted">untrusted</option>
          </select>
        </div>

        {sandbox === "workspace_write" ? (
          <p className="codex-direct-work-warning" role="status">
            workspace_write allows Codex to edit files inside the selected
            repository boundary.
          </p>
        ) : null}

        <details className="codex-direct-work-advanced">
          <summary className="codex-direct-work-advanced-summary">
            Advanced
          </summary>
          <div className="codex-direct-work-advanced-body">
            <p className="codex-direct-work-note">
              Leave these blank to use backend defaults.
            </p>
            <div className="codex-direct-work-controls">
              <div className="codex-direct-work-field codex-direct-work-field-wide">
                <label
                  className="codex-direct-work-label"
                  htmlFor={codexExecutableInputId}
                >
                  Codex executable
                </label>
                <Input
                  autoComplete="off"
                  id={codexExecutableInputId}
                  onChange={(event) =>
                    setCodexExecutableDraft(event.target.value)
                  }
                  spellCheck={false}
                  type="text"
                  value={codexExecutableDraft}
                />
                <p className="codex-direct-work-note">
                  On Windows, Hobit will also try codex.exe, codex.cmd, and
                  codex.bat from PATH when resolving `codex`.
                </p>
              </div>
              <CodexDirectWorkNumberField
                error={timeoutMsError}
                id={timeoutInputId}
                label="Timeout ms"
                onChange={setTimeoutMsDraft}
                value={timeoutMsDraft}
              />
              <CodexDirectWorkNumberField
                error={stdoutCapBytesError}
                id={stdoutCapInputId}
                label="Stdout cap bytes"
                onChange={setStdoutCapBytesDraft}
                value={stdoutCapBytesDraft}
              />
              <CodexDirectWorkNumberField
                error={stderrCapBytesError}
                id={stderrCapInputId}
                label="Stderr cap bytes"
                onChange={setStderrCapBytesDraft}
                value={stderrCapBytesDraft}
              />
            </div>
          </div>
        </details>

        {numericInputError ? (
          <p className="codex-direct-work-validation" role="alert">
            {numericInputError}
          </p>
        ) : null}
      </div>

      <div className="codex-direct-work-action-row">
        <Button disabled={!canRun} onClick={runDirectWork} variant="primary">
          {isRunning ? "Running..." : "Run Codex"}
        </Button>
        <p className="codex-direct-work-safety-copy">
          Direct Work can edit files when workspace-write is selected. No commit
          or push is created automatically. Review changes afterwards. This is
          one-shot, not an interactive terminal.
        </p>
      </div>

      {isRunning ? (
        <CodexDirectWorkNotice
          message="The desktop backend is running the existing Codex Direct Work command."
          title="Running Codex Direct Work"
          variant="info"
        />
      ) : null}

      {runErrorMessage ? (
        <CodexDirectWorkNotice
          message={runErrorMessage}
          title="Direct Work request failed"
          variant="error"
        />
      ) : null}

      {runResult ? <CodexDirectWorkResultCard result={runResult} /> : null}
    </section>
  );
}

function CodexDirectWorkNumberField({
  error,
  id,
  label,
  onChange,
  value,
}: {
  error?: string | null;
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="codex-direct-work-field">
      <label className="codex-direct-work-label" htmlFor={id}>
        {label}
      </label>
      <Input
        aria-invalid={error ? true : undefined}
        id={id}
        min={1}
        onChange={(event) => onChange(event.target.value)}
        step={1}
        type="number"
        value={value}
      />
    </div>
  );
}

function CodexDirectWorkNotice({
  message,
  title,
  variant,
}: {
  message: string;
  title: string;
  variant: "info" | "error";
}) {
  return (
    <div
      aria-live="polite"
      className={`codex-direct-work-notice codex-direct-work-notice-${variant}`}
      role="status"
    >
      <p className="codex-direct-work-notice-title">{title}</p>
      <p className="codex-direct-work-notice-text">{message}</p>
    </div>
  );
}

function CodexDirectWorkResultCard({
  result,
}: {
  result: RunCodexDirectWorkResponse;
}) {
  const statusView = codexResultStatusView(result);

  return (
    <section
      aria-label="Codex Direct Work result"
      className={`codex-direct-work-result codex-direct-work-result-${statusView.tone}`}
    >
      <div className="codex-direct-work-result-header">
        <div className="codex-direct-work-copy">
          <h3 className="codex-direct-work-title">{statusView.title}</h3>
          <p className="codex-direct-work-text">
            Immediate result from the one-shot Direct Work command.
          </p>
        </div>
        <Badge variant={statusView.badgeVariant}>{statusView.badgeLabel}</Badge>
      </div>

      <StaticPreviewFieldList
        className="codex-direct-work-result-grid"
        fieldClassName="codex-direct-work-result-field"
        fields={[
          { label: "Run id", value: result.runId },
          { label: "Result id", value: result.resultId },
          { label: "Status", value: result.status },
          {
            label: "Exit code",
            value: result.exitCode === null ? "None" : String(result.exitCode),
          },
          { label: "Duration", value: `${result.durationMs} ms` },
          { label: "Sandbox", value: result.sandbox },
          { label: "Approval policy", value: result.approvalPolicy },
          { label: "No auto commit", value: yesNo(result.noAutoCommit) },
          { label: "No auto push", value: yesNo(result.noAutoPush) },
          {
            label: "Git mutations by Hobit",
            value: yesNo(result.gitMutationsPerformedByHobit),
          },
        ]}
        labelClassName="codex-direct-work-result-label"
        valueClassName="codex-direct-work-result-value"
      />

      {result.errorMessage ? (
        <div className="codex-direct-work-error-message">
          <span className="codex-direct-work-result-label">Error message</span>
          <span className="codex-direct-work-result-value">
            {result.errorMessage}
          </span>
        </div>
      ) : null}

      <div className="codex-direct-work-final-message">
        <div className="codex-direct-work-output-header">
          <span className="codex-direct-work-result-label">
            Final response preview
          </span>
        </div>
        <pre className="codex-direct-work-output">
          <code>
            {previewOutput(
              result.finalMessage ?? "No final response captured.",
            )}
          </code>
        </pre>
      </div>

      <details className="codex-direct-work-output-details">
        <summary className="codex-direct-work-output-summary">
          stdout preview
          {result.stdoutTruncated ? (
            <Badge variant="warning">Backend truncated</Badge>
          ) : null}
        </summary>
        <pre className="codex-direct-work-output">
          <code>{previewOutput(result.stdout || "No stdout captured.")}</code>
        </pre>
      </details>

      <details className="codex-direct-work-output-details">
        <summary className="codex-direct-work-output-summary">
          stderr preview
          {result.stderrTruncated ? (
            <Badge variant="warning">Backend truncated</Badge>
          ) : null}
        </summary>
        <pre className="codex-direct-work-output">
          <code>{previewOutput(result.stderr || "No stderr captured.")}</code>
        </pre>
      </details>

      <details className="codex-direct-work-output-details">
        <summary className="codex-direct-work-output-summary">
          Command summary
        </summary>
        <pre className="codex-direct-work-output">
          <code>{result.commandSummary.join("\n") || "No command summary."}</code>
        </pre>
      </details>

      <p className="codex-direct-work-review-note">
        Review changed files in Git Widget after refresh.
      </p>
    </section>
  );
}

function codexResultStatusView(result: RunCodexDirectWorkResponse): {
  badgeLabel: string;
  badgeVariant: "neutral" | "info" | "success" | "warning" | "error";
  title: string;
  tone: "neutral" | "success" | "warning" | "error";
} {
  if (result.status === "completed" && result.exitCode === 0) {
    return {
      badgeLabel: "Completed",
      badgeVariant: "success",
      title: "Completed successfully",
      tone: "success",
    };
  }

  if (result.status === "completed") {
    return {
      badgeLabel: "Completed",
      badgeVariant: "warning",
      title: "Completed with nonzero exit",
      tone: "warning",
    };
  }

  if (result.status === "timed_out") {
    return {
      badgeLabel: "Timed out",
      badgeVariant: "warning",
      title: "Direct Work timed out",
      tone: "warning",
    };
  }

  if (result.status === "failed") {
    return {
      badgeLabel: "Failed",
      badgeVariant: "error",
      title: "Direct Work failed",
      tone: "error",
    };
  }

  return {
    badgeLabel: result.status,
    badgeVariant: "neutral",
    title: "Direct Work result",
    tone: "neutral",
  };
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

function previewOutput(value: string) {
  if (value.length <= OUTPUT_PREVIEW_LIMIT) {
    return value;
  }

  return `${value.slice(
    0,
    OUTPUT_PREVIEW_LIMIT,
  )}\n[Preview truncated in UI.]`;
}

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to run Codex Direct Work.";
}
