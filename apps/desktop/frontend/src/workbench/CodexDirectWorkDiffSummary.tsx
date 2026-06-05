import { useEffect, useState, type ReactNode } from "react";

import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import {
  RENDER_MEMORY_CAPS,
  cappedPreviewText,
} from "../renderMemoryGuards";
import type {
  AgentExecutorDiffFileSummary,
  AgentExecutorDiffSummary,
} from "../workspace/types";
import { StaticPreviewFieldList } from "./StaticPreviewPrimitives";
import type { WidgetInstanceId } from "./types";

const PATCH_PREVIEW_LIMIT = RENDER_MEMORY_CAPS.evidenceRawDetailsChars;

type DiffSummaryState =
  | {
      status: "idle";
    }
  | {
      status: "loading";
    }
  | {
      summary: AgentExecutorDiffSummary;
      status: "ready";
    }
  | {
      message: string;
      status: "failed";
    };

type DiffFileGroup = {
  badgeVariant: "neutral" | "info" | "success" | "warning" | "error";
  files: AgentExecutorDiffFileSummary[];
  key: string;
  title: string;
};

export type GetAgentExecutorDiffSummaryHandler = (
  widgetInstanceId: WidgetInstanceId,
  repositoryRoot: string,
) => Promise<AgentExecutorDiffSummary | null>;

type CodexDirectWorkDiffSummaryProps = {
  onGetAgentExecutorDiffSummary?: GetAgentExecutorDiffSummaryHandler;
  repositoryRoot: string;
  widgetInstanceId: WidgetInstanceId;
};

export function CodexDirectWorkDiffSummary({
  onGetAgentExecutorDiffSummary,
  repositoryRoot,
  widgetInstanceId,
}: CodexDirectWorkDiffSummaryProps) {
  const [diffState, setDiffState] = useState<DiffSummaryState>({
    status: "idle",
  });
  const isLoading = diffState.status === "loading";

  useEffect(() => {
    setDiffState({ status: "idle" });
  }, [repositoryRoot]);

  async function loadDiffSummary() {
    if (isLoading) {
      return;
    }

    if (!onGetAgentExecutorDiffSummary) {
      setDiffState({
        message: "Agent Executor diff summary is unavailable in this runtime.",
        status: "failed",
      });
      return;
    }

    setDiffState({ status: "loading" });

    try {
      const summary = await onGetAgentExecutorDiffSummary(
        widgetInstanceId,
        repositoryRoot,
      );

      if (!summary) {
        setDiffState({
          message: "Agent Executor diff summary was not returned.",
          status: "failed",
        });
        return;
      }

      setDiffState({ summary, status: "ready" });
    } catch (error) {
      setDiffState({
        message: errorToMessage(error),
        status: "failed",
      });
    }
  }

  const statusView = diffSummaryStatusView(diffState);

  return (
    <section
      aria-label="Agent Executor diff summary"
      className={`codex-direct-work-diff codex-direct-work-result codex-direct-work-result-${statusView.tone}`}
    >
      <div className="codex-direct-work-diff-header">
        <div className="codex-direct-work-copy">
          <h3 className="codex-direct-work-title">Diff summary</h3>
          <p className="codex-direct-work-text">
            Read-only Git diff summary for the Direct Work repo root.
          </p>
        </div>
        <div className="codex-direct-work-diff-actions">
          <Badge variant={statusView.badgeVariant}>{statusView.badgeLabel}</Badge>
          <Button
            disabled={isLoading}
            onClick={() => void loadDiffSummary()}
            variant="secondary"
          >
            {isLoading
              ? "Refreshing..."
              : diffState.status === "ready"
                ? "Refresh diff summary"
                : "Load diff summary"}
          </Button>
        </div>
      </div>

      <p className="codex-direct-work-review-note">
        Read-only Git diff summary. No stage, commit, push, reset, clean,
        checkout, restore, or patch apply.
      </p>

      <StaticPreviewFieldList
        className="codex-direct-work-result-grid"
        fieldClassName="codex-direct-work-result-field"
        fields={[
          { label: "Repo root", value: repositoryRoot },
          ...diffSummaryTotalsFields(diffState),
        ]}
        labelClassName="codex-direct-work-result-label"
        valueClassName="codex-direct-work-result-value"
      />

      {diffState.status === "idle" ? (
        <p className="codex-direct-work-review-note">
          Diff summary not loaded yet.
        </p>
      ) : null}

      {diffState.status === "loading" ? (
        <p className="codex-direct-work-review-note">
          Reading read-only Git diff summary...
        </p>
      ) : null}

      {diffState.status === "failed" ? (
        <div className="codex-direct-work-error-message" role="status">
          <span className="codex-direct-work-result-label">
            Diff summary unavailable
          </span>
          <span className="codex-direct-work-result-value">
            {diffState.message}
          </span>
        </div>
      ) : null}

      {diffState.status === "ready" ? (
        <DiffSummaryResult summary={diffState.summary} />
      ) : null}
    </section>
  );
}

function DiffSummaryResult({
  summary,
}: {
  summary: AgentExecutorDiffSummary;
}) {
  if (summary.status === "clean") {
    return (
      <div className="git-changed-files-empty">
        No repository changes detected.
      </div>
    );
  }

  if (summary.status === "unavailable" || summary.status === "failed") {
    return (
      <div className="codex-direct-work-error-message" role="status">
        <span className="codex-direct-work-result-label">
          Repository diff status
        </span>
        <span className="codex-direct-work-result-value">
          {summary.errorMessage ??
            `Git diff summary returned status "${summary.status}".`}
        </span>
      </div>
    );
  }

  const groups = diffFileGroups(summary.files).filter(
    (group) => group.files.length > 0,
  );

  if (groups.length === 0) {
    return (
      <div className="git-changed-files-empty">
        No repository changes detected.
      </div>
    );
  }

  return (
    <div className="codex-direct-work-diff-groups">
      {groups.map((group) => (
        <DiffFileGroupSection group={group} key={group.key} />
      ))}
    </div>
  );
}

function DiffFileGroupSection({ group }: { group: DiffFileGroup }) {
  return (
    <section className="codex-direct-work-diff-group">
      <div className="codex-direct-work-diff-group-header">
        <h4 className="codex-direct-work-title">{group.title}</h4>
        <Badge variant={group.badgeVariant}>{group.files.length}</Badge>
      </div>

      <div className="codex-direct-work-diff-file-list">
        {group.files.map((file, index) => (
          <DiffFileRow
            file={file}
            groupKey={group.key}
            key={`${group.key}-${file.path}-${index}`}
          />
        ))}
      </div>
    </section>
  );
}

function DiffFileRow({
  file,
  groupKey,
}: {
  file: AgentExecutorDiffFileSummary;
  groupKey: string;
}) {
  const patchState = diffFilePatchState(file);

  return (
    <article className="codex-direct-work-diff-file">
      <div className="codex-direct-work-diff-file-main">
        <code className="git-changed-file-path">{file.path}</code>
        <div className="git-changed-file-badges">
          <Badge variant={diffStatusBadgeVariant(file)}>{file.status}</Badge>
          <Badge variant="neutral">{groupKey}</Badge>
          {file.staged ? <Badge variant="info">staged</Badge> : null}
          {file.unstaged ? <Badge variant="warning">unstaged</Badge> : null}
          {file.untracked ? <Badge variant="neutral">untracked</Badge> : null}
          {file.conflicted ? <Badge variant="error">conflicted</Badge> : null}
          {file.patchPreview ? (
            <Badge variant="info">patch preview available</Badge>
          ) : (
            <Badge variant="neutral">no patch preview</Badge>
          )}
          {file.patchTruncated ? (
            <Badge variant="warning">Patch preview truncated</Badge>
          ) : null}
        </div>
      </div>

      <p className="codex-direct-work-review-note">
        {lineDeltaLabel(file)}
      </p>

      {file.patchPreview ? (
        <LazyDetails
          className="codex-direct-work-output-details"
          summary={
            <>
              Patch preview
              {file.patchTruncated ? (
                <Badge variant="warning">Patch preview truncated</Badge>
              ) : null}
            </>
          }
        >
          <pre className="codex-direct-work-output codex-direct-work-diff-patch">
            <code>{previewPatch(file.patchPreview)}</code>
          </pre>
        </LazyDetails>
      ) : (
        <p className="codex-direct-work-review-note">{patchState}</p>
      )}
    </article>
  );
}

function LazyDetails({
  children,
  className,
  summary,
}: {
  children: ReactNode;
  className: string;
  summary: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <details
      className={className}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary className="codex-direct-work-output-summary">
        {summary}
      </summary>
      {isOpen ? children : null}
    </details>
  );
}

function diffSummaryTotalsFields(state: DiffSummaryState) {
  if (state.status !== "ready") {
    return [{ label: "Repo status", value: "Not loaded" }];
  }

  const totals = state.summary.summary;

  return [
    { label: "Repo status", value: state.summary.status },
    { label: "Total files", value: String(totals.totalFiles) },
    { label: "Staged", value: String(totals.stagedCount) },
    { label: "Unstaged", value: String(totals.unstagedCount) },
    { label: "Untracked", value: String(totals.untrackedCount) },
    { label: "Conflicted", value: String(totals.conflictedCount) },
    {
      label: "Total additions",
      value: valueOrUnavailable(totals.totalAdditions),
    },
    {
      label: "Total deletions",
      value: valueOrUnavailable(totals.totalDeletions),
    },
  ];
}

function diffFileGroups(files: AgentExecutorDiffFileSummary[]): DiffFileGroup[] {
  return [
    {
      badgeVariant: "error",
      files: files.filter((file) => file.conflicted),
      key: "conflicted",
      title: "Conflicted",
    },
    {
      badgeVariant: "info",
      files: files.filter(
        (file) => file.staged && !file.conflicted && !file.untracked,
      ),
      key: "staged",
      title: "Staged",
    },
    {
      badgeVariant: "warning",
      files: files.filter(
        (file) =>
          file.unstaged && !file.staged && !file.conflicted && !file.untracked,
      ),
      key: "unstaged",
      title: "Unstaged",
    },
    {
      badgeVariant: "neutral",
      files: files.filter((file) => file.untracked && !file.conflicted),
      key: "untracked",
      title: "Untracked",
    },
    {
      badgeVariant: "neutral",
      files: files.filter(
        (file) =>
          !file.staged &&
          !file.unstaged &&
          !file.untracked &&
          !file.conflicted,
      ),
      key: "unknown",
      title: "Unknown",
    },
  ];
}

function diffSummaryStatusView(state: DiffSummaryState): {
  badgeLabel: string;
  badgeVariant: "neutral" | "info" | "success" | "warning" | "error";
  tone: "neutral" | "success" | "warning" | "error";
} {
  if (state.status === "loading") {
    return {
      badgeLabel: "Reading",
      badgeVariant: "info",
      tone: "neutral",
    };
  }

  if (state.status === "failed") {
    return {
      badgeLabel: "Unavailable",
      badgeVariant: "error",
      tone: "error",
    };
  }

  if (state.status === "ready") {
    if (state.summary.status === "clean") {
      return {
        badgeLabel: "Clean",
        badgeVariant: "success",
        tone: "success",
      };
    }

    if (state.summary.status === "dirty") {
      return {
        badgeLabel: `${state.summary.summary.totalFiles} files`,
        badgeVariant: "warning",
        tone: "warning",
      };
    }

    return {
      badgeLabel: state.summary.status,
      badgeVariant:
        state.summary.status === "failed" ||
        state.summary.status === "unavailable"
          ? "error"
          : "neutral",
      tone:
        state.summary.status === "failed" ||
        state.summary.status === "unavailable"
          ? "error"
          : "neutral",
    };
  }

  return {
    badgeLabel: "Not loaded",
    badgeVariant: "neutral",
    tone: "neutral",
  };
}

function diffStatusBadgeVariant(
  file: AgentExecutorDiffFileSummary,
): "neutral" | "info" | "success" | "warning" | "error" {
  if (file.conflicted || file.status === "conflicted") {
    return "error";
  }

  if (file.untracked || file.status === "untracked") {
    return "neutral";
  }

  if (file.staged) {
    return "info";
  }

  if (file.unstaged) {
    return "warning";
  }

  return "neutral";
}

function diffFilePatchState(file: AgentExecutorDiffFileSummary) {
  if (file.untracked) {
    return "Patch preview not available for untracked files.";
  }

  return "Patch preview not returned for this file.";
}

function lineDeltaLabel(file: AgentExecutorDiffFileSummary) {
  if (file.additions === null && file.deletions === null) {
    return "Line totals unavailable.";
  }

  return `Additions ${valueOrUnavailable(file.additions)} / deletions ${valueOrUnavailable(file.deletions)}`;
}

function previewPatch(patch: string) {
  return cappedPreviewText(patch, PATCH_PREVIEW_LIMIT, "Preview capped");
}

function valueOrUnavailable(value: number | null) {
  return value === null ? "Unavailable" : String(value);
}

function errorToMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unable to load Agent Executor diff summary.";
}
