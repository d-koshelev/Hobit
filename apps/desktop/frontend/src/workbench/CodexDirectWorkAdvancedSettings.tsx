import { Input } from "../design-system/Input";

const DEFAULT_CODEX_DIRECT_WORK_TIMEOUT_MS = "600000";

type CodexDirectWorkAdvancedSettingsProps = {
  codexExecutableInputId: string;
  codexExecutableDraft: string;
  onCodexExecutableDraftChange: (value: string) => void;
  timeoutInputId: string;
  timeoutMsDraft: string;
  onTimeoutMsDraftChange: (value: string) => void;
  timeoutMsError: string | null;
  stdoutCapInputId: string;
  stdoutCapBytesDraft: string;
  onStdoutCapBytesDraftChange: (value: string) => void;
  stdoutCapBytesError: string | null;
  stderrCapInputId: string;
  stderrCapBytesDraft: string;
  onStderrCapBytesDraftChange: (value: string) => void;
  stderrCapBytesError: string | null;
};

export function CodexDirectWorkAdvancedSettings({
  codexExecutableInputId,
  codexExecutableDraft,
  onCodexExecutableDraftChange,
  timeoutInputId,
  timeoutMsDraft,
  onTimeoutMsDraftChange,
  timeoutMsError,
  stdoutCapInputId,
  stdoutCapBytesDraft,
  onStdoutCapBytesDraftChange,
  stdoutCapBytesError,
  stderrCapInputId,
  stderrCapBytesDraft,
  onStderrCapBytesDraftChange,
  stderrCapBytesError,
}: CodexDirectWorkAdvancedSettingsProps) {
  return (
    <details className="codex-direct-work-advanced">
      <summary className="codex-direct-work-advanced-summary">Advanced</summary>
      <div className="codex-direct-work-advanced-body">
        <p className="codex-direct-work-note">
          Leave timeout and output caps blank to use backend defaults. Backend default
          timeout is {DEFAULT_CODEX_DIRECT_WORK_TIMEOUT_MS} ms.
        </p>
        <div className="codex-direct-work-controls">
          <div className="codex-direct-work-field codex-direct-work-field-wide">
            <label className="codex-direct-work-label" htmlFor={codexExecutableInputId}>
              Codex executable
            </label>
            <Input
              autoComplete="off"
              id={codexExecutableInputId}
              onChange={(event) => onCodexExecutableDraftChange(event.target.value)}
              spellCheck={false}
              type="text"
              value={codexExecutableDraft}
            />
            <p className="codex-direct-work-note">
              Windows default uses codex.cmd. Full path is allowed if needed.
            </p>
          </div>
          <CodexDirectWorkNumberField
            error={timeoutMsError}
            id={timeoutInputId}
            label="Timeout ms"
            onChange={onTimeoutMsDraftChange}
            value={timeoutMsDraft}
          />
          <CodexDirectWorkNumberField
            error={stdoutCapBytesError}
            id={stdoutCapInputId}
            label="Stdout cap bytes"
            onChange={onStdoutCapBytesDraftChange}
            value={stdoutCapBytesDraft}
          />
          <CodexDirectWorkNumberField
            error={stderrCapBytesError}
            id={stderrCapInputId}
            label="Stderr cap bytes"
            onChange={onStderrCapBytesDraftChange}
            value={stderrCapBytesDraft}
          />
        </div>
      </div>
    </details>
  );
}

type CodexDirectWorkNumberFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
};

function CodexDirectWorkNumberField({
  id,
  label,
  value,
  onChange,
  error,
}: CodexDirectWorkNumberFieldProps) {
  return (
    <div className="codex-direct-work-field">
      <label className="codex-direct-work-label" htmlFor={id}>
        {label}
      </label>
      <Input
        aria-invalid={error ? true : undefined}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        min={1}
        step={1}
        type="number"
        value={value}
      />
    </div>
  );
}
