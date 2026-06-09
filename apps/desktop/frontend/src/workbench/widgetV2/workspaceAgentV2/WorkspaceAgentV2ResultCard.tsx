import { useState } from "react";

import type {
  AgentFileChangeSummary,
  AgentRunResult,
  AgentValidationSuggestion,
} from "../../agentRuntime";
import { summarizeAgentRunMetadata } from "../../agentRuntime";

type WorkspaceAgentV2ResultCardProps = {
  readonly result: AgentRunResult;
};

export function WorkspaceAgentV2ResultCard({
  result,
}: WorkspaceAgentV2ResultCardProps) {
  const [showDeveloperDetails, setShowDeveloperDetails] = useState(false);
  const metadata = summarizeAgentRunMetadata(result.metadata);
  const warnings = result.warnings ?? [];
  const compactSummary = directRunCompactSummary(result, metadata);

  return (
    <section
      aria-label="Direct Run result review"
      className="workspace-agent-v2-result-card"
      data-status={result.lifecycle}
    >
      <div className="workspace-agent-v2-result-card-header">
        <div>
          <h4>Direct Run result</h4>
          <p>{metadata.providerLabel}</p>
        </div>
        <span
          className="workspace-agent-v2-result-status"
          data-status={result.lifecycle}
        >
          {metadata.lifecycleLabel}
        </span>
      </div>

      <dl className="workspace-agent-v2-result-meta">
        <ResultMetaItem label="Run" value={result.runId} />
        <ResultMetaItem label="Provider" value={metadata.providerLabel} />
        {metadata.durationLabel ? (
          <ResultMetaItem label="Duration" value={metadata.durationLabel} />
        ) : null}
      </dl>

      <section className="workspace-agent-v2-result-section">
        <h5>Summary</h5>
        <p>{compactSummary}</p>
      </section>

      <FileChangesSection fileChanges={result.fileChanges} />
      <ValidationSuggestionsSection
        suggestions={result.validationSuggestions}
      />
      <WarningsSection errorMessage={result.errorMessage} warnings={warnings} />

      <button
        className="button button-secondary button-sm workspace-agent-v2-result-queue-follow-up"
        disabled
        type="button"
      >
        Queue follow-up
      </button>

      <details className="workspace-agent-v2-result-developer-details">
        <summary onClick={() => setShowDeveloperDetails(true)}>
          Developer details
        </summary>
        {showDeveloperDetails ? <pre>{JSON.stringify(result, null, 2)}</pre> : null}
      </details>
    </section>
  );
}

function directRunCompactSummary(
  result: AgentRunResult,
  metadata: ReturnType<typeof summarizeAgentRunMetadata>,
) {
  const parts = [
    metadata.lifecycleLabel,
    metadata.durationLabel,
    metadata.tokenUsageLabel ? `tokens ${metadata.tokenUsageLabel}` : null,
    result.errorMessage ? "1 error" : null,
    result.warnings && result.warnings.length > 0
      ? `${result.warnings.length.toString()} ${
          result.warnings.length === 1 ? "warning" : "warnings"
        }`
      : null,
  ].filter((part): part is string => Boolean(part));

  return parts.join(" - ");
}

function ResultMetaItem({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function FileChangesSection({
  fileChanges,
}: {
  readonly fileChanges: readonly AgentFileChangeSummary[];
}) {
  return (
    <section className="workspace-agent-v2-result-section">
      <h5>File changes</h5>
      {fileChanges.length > 0 ? (
        <ul className="workspace-agent-v2-result-list">
          {fileChanges.map((change) => (
            <li key={`${change.status}:${change.path}`}>
              <span>{fileChangeStatusLabel(change.status)}</span>
              <strong>{change.path}</strong>
              {lineChangeLabel(change) ? <em>{lineChangeLabel(change)}</em> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p>No file-change summary was reported.</p>
      )}
    </section>
  );
}

function ValidationSuggestionsSection({
  suggestions,
}: {
  readonly suggestions: readonly AgentValidationSuggestion[];
}) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <section className="workspace-agent-v2-result-section">
      <h5>Validation suggestions</h5>
      <ul className="workspace-agent-v2-result-list">
        {suggestions.map((suggestion) => (
          <li key={suggestion.id}>
            <span>{validationStatusLabel(suggestion.status)}</span>
            <strong>{suggestion.label}</strong>
            <em>{suggestion.command ?? suggestion.reason}</em>
          </li>
        ))}
      </ul>
    </section>
  );
}

function WarningsSection({
  errorMessage,
  warnings,
}: {
  readonly errorMessage?: string;
  readonly warnings: readonly string[];
}) {
  if (!errorMessage && warnings.length === 0) {
    return null;
  }

  return (
    <section className="workspace-agent-v2-result-section">
      <h5>Warnings / errors</h5>
      {errorMessage ? <p>{errorMessage}</p> : null}
      {warnings.length > 0 ? (
        <ul className="workspace-agent-v2-result-list">
          {warnings.map((warning) => (
            <li key={warning}>
              <span>Warning</span>
              <strong>{warning}</strong>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function fileChangeStatusLabel(status: AgentFileChangeSummary["status"]) {
  if (status === "added") {
    return "Added";
  }
  if (status === "deleted") {
    return "Deleted";
  }
  if (status === "renamed") {
    return "Renamed";
  }
  if (status === "unchanged") {
    return "Unchanged";
  }
  return "Modified";
}

function lineChangeLabel(change: AgentFileChangeSummary) {
  const parts = [
    typeof change.addedLines === "number" ? `+${change.addedLines}` : null,
    typeof change.deletedLines === "number" ? `-${change.deletedLines}` : null,
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(" / ") : null;
}

function validationStatusLabel(status: AgentValidationSuggestion["status"]) {
  if (status === "passed") {
    return "Passed";
  }
  if (status === "failed") {
    return "Failed";
  }
  if (status === "running") {
    return "Running";
  }
  if (status === "skipped") {
    return "Skipped";
  }
  return "Suggested";
}
