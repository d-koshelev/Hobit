import {
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import type {
  GitCommitResponse,
  GitFileChange,
  GitRepositoryStatus,
} from "../workspace/types";
import {
  gitChangeAreaLabel,
  gitChangeKindBadgeVariant,
  gitChangeKindLabel,
} from "./gitStatusViewModel";

type GitCommitCreateRequest = {
  commitMessage: string;
  includedFiles: string[];
  repoRoot: string;
};

type GitWidgetCommitPanelProps = {
  isRefreshingStatus: boolean;
  onCreateGitCommit?: (
    request: GitCommitCreateRequest,
  ) => Promise<GitCommitResponse | null>;
  onRefreshStatusAfterCommit?: () => Promise<void>;
  repositoryRoot: string | null;
  status: GitRepositoryStatus | null;
};

type CommitCandidate = {
  areas: string[];
  kinds: string[];
  label: string;
  path: string;
};

export function GitWidgetCommitPanel({
  isRefreshingStatus,
  onCreateGitCommit,
  onRefreshStatusAfterCommit,
  repositoryRoot,
  status,
}: GitWidgetCommitPanelProps) {
  const commitMessageInputId = useId();
  const candidates = useMemo(
    () => buildCommitCandidates(status?.changedFiles ?? []),
    [status?.changedFiles],
  );
  const candidateKey = candidates.map((candidate) => candidate.path).join("\n");
  const [selectedFilePaths, setSelectedFilePaths] = useState<string[]>([]);
  const [commitMessage, setCommitMessage] = useState("");
  const [messageError, setMessageError] = useState<string | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<GitCommitResponse | null>(
    null,
  );
  const [refreshAfterCommitError, setRefreshAfterCommitError] = useState<
    string | null
  >(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const candidatePathSet = useMemo(
    () => new Set(candidates.map((candidate) => candidate.path)),
    [candidates],
  );
  const selectedCandidates = candidates.filter((candidate) =>
    selectedFilePaths.includes(candidate.path),
  );
  const selectedFiles = selectedCandidates.map((candidate) => candidate.path);
  const excludedChangedFileCount =
    (status?.changedFiles.length ?? 0) - candidates.length;
  const hasChangedFiles = Boolean(status && status.changedFiles.length > 0);
  const hasSelectableFiles = candidates.length > 0;
  const allCandidatesSelected =
    hasSelectableFiles && selectedFiles.length === candidates.length;

  useEffect(() => {
    setSelectedFilePaths(candidates.map((candidate) => candidate.path));
    setIsConfirming(false);
    setMessageError(null);
    setCommitError(null);
    setRefreshAfterCommitError(null);
  }, [candidateKey]);

  function updateCommitMessage(value: string) {
    setCommitMessage(value);
    setMessageError(null);
  }

  function toggleSelectedFile(path: string) {
    if (!candidatePathSet.has(path)) {
      return;
    }

    setSelectedFilePaths((currentPaths) =>
      currentPaths.includes(path)
        ? currentPaths.filter((currentPath) => currentPath !== path)
        : [...currentPaths, path],
    );
    setIsConfirming(false);
    setCommitError(null);
  }

  function selectAllFiles() {
    setSelectedFilePaths(candidates.map((candidate) => candidate.path));
    setIsConfirming(false);
    setCommitError(null);
  }

  function clearSelectedFiles() {
    setSelectedFilePaths([]);
    setIsConfirming(false);
    setCommitError(null);
  }

  function startConfirmation() {
    const trimmedMessage = commitMessage.trim();

    setCommitError(null);
    setCommitResult(null);
    setRefreshAfterCommitError(null);

    if (!trimmedMessage) {
      setMessageError("Enter a commit message before confirming.");
      setIsConfirming(false);
      return;
    }

    if (selectedFiles.length === 0) {
      setMessageError("Select at least one changed file to include.");
      setIsConfirming(false);
      return;
    }

    setMessageError(null);
    setIsConfirming(true);
  }

  async function confirmCommit() {
    const trimmedMessage = commitMessage.trim();

    if (!repositoryRoot || !trimmedMessage || selectedFiles.length === 0) {
      setIsConfirming(false);
      return;
    }

    if (!onCreateGitCommit) {
      setCommitError("Git commit creation is unavailable in this runtime.");
      setIsConfirming(false);
      return;
    }

    setIsCommitting(true);
    setCommitError(null);
    setCommitResult(null);
    setRefreshAfterCommitError(null);

    try {
      const result = await onCreateGitCommit({
        commitMessage: trimmedMessage,
        includedFiles: selectedFiles,
        repoRoot: repositoryRoot,
      });

      if (!result) {
        setCommitError("Git commit was not returned for this widget.");
        setIsConfirming(false);
        return;
      }

      setCommitResult(result);
      setIsConfirming(false);

      if (result.status === "committed" && onRefreshStatusAfterCommit) {
        try {
          await onRefreshStatusAfterCommit();
        } catch (error) {
          setRefreshAfterCommitError(errorToMessage(error));
        }
      }
    } catch (error) {
      setCommitError(errorToMessage(error));
      setIsConfirming(false);
    } finally {
      setIsCommitting(false);
    }
  }

  return (
    <section aria-label="Create local Git commit" className="git-commit-panel">
      <div className="git-commit-header">
        <div className="git-status-title-copy">
          <h3 className="git-status-card-title">Local commit</h3>
          <p className="git-status-card-subtitle">
            Explicit operator-approved commit for the selected files
          </p>
        </div>
        <Badge variant="warning">Confirmation required</Badge>
      </div>

      <p className="git-commit-safety-copy">
        Local commit only. No push will be performed. No reset or clean will be
        performed. Only selected files are included.
      </p>

      <p className="git-commit-review-note">
        Review validation status before committing if this change came from
        Agent Executor.
      </p>

      {!repositoryRoot || !status ? (
        <GitCommitNotice
          message={
            isRefreshingStatus
              ? "Commit is unavailable while Git status is refreshing."
              : "Commit unavailable until Git status is loaded."
          }
          title="Commit unavailable"
        />
      ) : null}

      {repositoryRoot && status && !hasChangedFiles ? (
        <GitCommitNotice
          message="No changes to commit."
          title="Working tree clean"
        />
      ) : null}

      {repositoryRoot && status && hasChangedFiles && !hasSelectableFiles ? (
        <GitCommitNotice
          message="No selectable changed files were available in this status snapshot."
          title="Commit unavailable"
        />
      ) : null}

      {repositoryRoot && status && hasSelectableFiles ? (
        <>
          <div className="git-commit-field">
            <label
              className="git-commit-field-label"
              htmlFor={commitMessageInputId}
            >
              Commit message
            </label>
            <textarea
              className="input git-commit-message-input"
              disabled={isCommitting}
              id={commitMessageInputId}
              onChange={(event) => updateCommitMessage(event.target.value)}
              placeholder="Describe this local commit"
              spellCheck
              value={commitMessage}
            />
            {messageError ? (
              <p className="git-commit-field-error">{messageError}</p>
            ) : null}
          </div>

          <div className="git-commit-selection-header">
            <div className="git-status-title-copy">
              <h4 className="git-changed-file-group-title">
                Included files
              </h4>
              <p className="git-status-card-subtitle">
                Repo-relative paths from the latest status snapshot
              </p>
            </div>
            <div className="git-commit-selection-actions">
              <Badge variant="neutral">{selectedFiles.length} selected</Badge>
              <Button
                disabled={allCandidatesSelected || isCommitting}
                onClick={selectAllFiles}
                variant="ghost"
              >
                Select all
              </Button>
              <Button
                disabled={selectedFiles.length === 0 || isCommitting}
                onClick={clearSelectedFiles}
                variant="ghost"
              >
                Clear
              </Button>
            </div>
          </div>

          {excludedChangedFileCount > 0 ? (
            <p className="git-commit-review-note">
              {excludedChangedFileCount} changed paths were not selectable
              because they were not safe repo-relative file paths.
            </p>
          ) : null}

          <div className="git-commit-file-list">
            {candidates.map((candidate) => (
              <GitCommitFileRow
                candidate={candidate}
                checked={selectedFilePaths.includes(candidate.path)}
                disabled={isCommitting}
                key={candidate.path}
                onToggle={toggleSelectedFile}
              />
            ))}
          </div>

          {isConfirming ? (
            <GitCommitConfirmation
              commitMessage={commitMessage.trim()}
              isCommitting={isCommitting}
              onBack={() => setIsConfirming(false)}
              onConfirm={() => void confirmCommit()}
              repositoryRoot={repositoryRoot}
              selectedCandidates={selectedCandidates}
            />
          ) : (
            <Button
              disabled={isCommitting || selectedFiles.length === 0}
              onClick={startConfirmation}
              variant="primary"
            >
              {isCommitting ? "Creating commit..." : "Create local commit"}
            </Button>
          )}
        </>
      ) : null}

      {commitError ? <GitCommitErrorNotice message={commitError} /> : null}

      {commitResult ? (
        <GitCommitResultView
          refreshAfterCommitError={refreshAfterCommitError}
          result={commitResult}
        />
      ) : null}
    </section>
  );
}

function GitCommitNotice({
  message,
  title,
}: {
  message: string;
  title: string;
}) {
  return (
    <div className="git-commit-notice">
      <p className="git-status-feedback-title">{title}</p>
      <p className="git-status-feedback-text">{message}</p>
    </div>
  );
}

function GitCommitFileRow({
  candidate,
  checked,
  disabled,
  onToggle,
}: {
  candidate: CommitCandidate;
  checked: boolean;
  disabled: boolean;
  onToggle: (path: string) => void;
}) {
  return (
    <label className="git-commit-file-row">
      <input
        checked={checked}
        className="git-commit-file-checkbox"
        disabled={disabled}
        onChange={() => onToggle(candidate.path)}
        type="checkbox"
      />
      <span className="git-commit-file-main">
        <code className="git-changed-file-path">{candidate.label}</code>
        <span className="git-changed-file-badges">
          {candidate.areas.map((area) => (
            <Badge key={area} variant="neutral">
              {gitChangeAreaLabel(area)}
            </Badge>
          ))}
          {candidate.kinds.map((kind) => (
            <Badge key={kind} variant={gitChangeKindBadgeVariant(kind)}>
              {gitChangeKindLabel(kind)}
            </Badge>
          ))}
        </span>
      </span>
    </label>
  );
}

function GitCommitConfirmation({
  commitMessage,
  isCommitting,
  onBack,
  onConfirm,
  repositoryRoot,
  selectedCandidates,
}: {
  commitMessage: string;
  isCommitting: boolean;
  onBack: () => void;
  onConfirm: () => void;
  repositoryRoot: string;
  selectedCandidates: CommitCandidate[];
}) {
  return (
    <div className="git-commit-confirmation">
      <div className="git-commit-confirmation-header">
        <div className="git-status-title-copy">
          <h4 className="git-changed-file-group-title">
            Confirm local commit
          </h4>
          <p className="git-status-card-subtitle">
            Selected files will be staged for this commit.
          </p>
        </div>
        <Badge variant="warning">Local only</Badge>
      </div>

      <div className="git-commit-confirmation-field">
        <span className="git-commit-field-label">Repository root</span>
        <code className="git-status-root-value">{repositoryRoot}</code>
      </div>

      <div className="git-commit-confirmation-field">
        <span className="git-commit-field-label">Commit message</span>
        <pre className="git-commit-message-preview">{commitMessage}</pre>
      </div>

      <div className="git-commit-confirmation-field">
        <span className="git-commit-field-label">
          Selected files ({selectedCandidates.length})
        </span>
        <div className="git-commit-confirmation-file-list">
          {selectedCandidates.map((candidate) => (
            <code className="git-changed-file-path" key={candidate.path}>
              {candidate.label}
            </code>
          ))}
        </div>
      </div>

      <ul className="git-commit-warning-list">
        <li>Local commit only. No push will be performed.</li>
        <li>Selected files will be staged for the commit.</li>
        <li>No reset, clean, or undo will be performed.</li>
      </ul>

      <div className="git-commit-action-row">
        <Button disabled={isCommitting} onClick={onBack} variant="secondary">
          Back
        </Button>
        <Button disabled={isCommitting} onClick={onConfirm} variant="primary">
          {isCommitting ? "Creating commit..." : "Confirm local commit"}
        </Button>
      </div>
    </div>
  );
}

function GitCommitErrorNotice({ message }: { message: string }) {
  return (
    <div aria-live="polite" className="git-commit-result git-commit-result-error">
      <p className="git-commit-result-title">Commit failed</p>
      <p className="git-commit-result-text">{message}</p>
    </div>
  );
}

function GitCommitResultView({
  refreshAfterCommitError,
  result,
}: {
  refreshAfterCommitError: string | null;
  result: GitCommitResponse;
}) {
  const isSuccess = result.status === "committed";

  return (
    <div
      aria-live="polite"
      className={`git-commit-result git-commit-result-${
        isSuccess ? "success" : "error"
      }`}
    >
      <div className="git-commit-result-header">
        <div className="git-status-title-copy">
          <p className="git-commit-result-title">
            {isSuccess ? "Commit created" : "Commit failed"}
          </p>
          <p className="git-commit-result-text">
            {isSuccess
              ? "Local Git commit completed."
              : (result.errorMessage ?? "Git reported a commit failure.")}
          </p>
        </div>
        <Badge variant={isSuccess ? "success" : "error"}>
          {result.status}
        </Badge>
      </div>

      <div className="git-commit-result-grid">
        <GitCommitResultField
          label="Commit hash"
          value={
            result.commitHash ? (
              <code>{result.commitHash}</code>
            ) : (
              "Not returned"
            )
          }
        />
        <GitCommitResultField
          label="Branch"
          value={result.branch ?? "Not returned"}
        />
        <GitCommitResultField
          label="Duration"
          value={formatCommitDuration(result.durationMs)}
        />
        <GitCommitResultField
          label="Exit code"
          value={result.exitCode === null ? "Not returned" : result.exitCode}
        />
        <GitCommitResultField
          label="Included files"
          value={result.includedFiles.length}
        />
      </div>

      {refreshAfterCommitError ? (
        <p className="git-commit-result-text">
          Commit succeeded, but status refresh failed: {refreshAfterCommitError}
        </p>
      ) : null}

      {result.stdout ? (
        <GitCommitOutputDetails label="stdout" value={result.stdout} />
      ) : null}
      {result.stderr ? (
        <GitCommitOutputDetails label="stderr" value={result.stderr} />
      ) : null}
    </div>
  );
}

function GitCommitResultField({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="git-commit-result-field">
      <span className="git-commit-result-label">{label}</span>
      <span className="git-commit-result-value">{value}</span>
    </div>
  );
}

function GitCommitOutputDetails({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <details className="git-commit-output-details">
      <summary className="git-commit-output-summary">{label}</summary>
      <pre className="git-commit-output">
        <code>{value}</code>
      </pre>
    </details>
  );
}

function buildCommitCandidates(files: GitFileChange[]): CommitCandidate[] {
  const candidates = new Map<string, CommitCandidate>();

  for (const file of files) {
    if (!isSafeRepoRelativeFilePath(file.path)) {
      continue;
    }

    const existingCandidate = candidates.get(file.path);

    if (existingCandidate) {
      addUnique(existingCandidate.areas, file.area);
      addUnique(existingCandidate.kinds, file.kind);
      continue;
    }

    candidates.set(file.path, {
      areas: [file.area],
      kinds: [file.kind],
      label: file.path,
      path: file.path,
    });
  }

  return Array.from(candidates.values());
}

function addUnique(items: string[], item: string) {
  if (!items.includes(item)) {
    items.push(item);
  }
}

function isSafeRepoRelativeFilePath(path: string) {
  const normalizedPath = path.split("\\").join("/");

  if (!path || path.trim() !== path || path.includes("\0")) {
    return false;
  }

  if (
    path.startsWith("-") ||
    path.startsWith(":") ||
    path.startsWith("/") ||
    path.startsWith("\\\\") ||
    /^[A-Za-z]:[\\/]/.test(path)
  ) {
    return false;
  }

  if (
    normalizedPath === "." ||
    normalizedPath === ".." ||
    normalizedPath.endsWith("/") ||
    normalizedPath.startsWith("../") ||
    normalizedPath.includes("/../") ||
    normalizedPath.includes("/./")
  ) {
    return false;
  }

  return !/[?*[\]]/.test(path);
}

function formatCommitDuration(durationMs: number) {
  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  return `${(durationMs / 1000).toFixed(1)} s`;
}

function errorToMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Git commit creation failed.";
}
