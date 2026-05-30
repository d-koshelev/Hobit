import { useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import type { JdbcReadOnlyQueryResult } from "../workspace/jdbcQueryTypes";
import { JdbcQueryErrorPanel } from "./JdbcQueryErrorPanel";
import { JdbcQueryResultTable } from "./JdbcQueryResultTable";
import {
  copyTextToClipboard,
  formatBytes,
  resultSummaryText,
  resultToTsv,
} from "./jdbcQueryResultFormatters";

export function JdbcReadOnlyQueryResultView({
  maxResultBytes,
  result,
  timeoutMs,
}: {
  maxResultBytes: number;
  result: JdbcReadOnlyQueryResult;
  timeoutMs: number;
}) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  async function handleCopyResults() {
    const copied = await copyTextToClipboard(resultToTsv(result));
    setCopyMessage(copied ? "Results copied as TSV." : "Copy failed.");
  }

  if (result.status !== "completed") {
    return (
      <JdbcQueryErrorPanel
        copyMessage={copyMessage}
        onCopyMessageChange={setCopyMessage}
        result={result}
      />
    );
  }

  return (
    <div className="jdbc-result-shell">
      <div className="jdbc-result-toolbar">
        <div className="jdbc-result-meta">
          <Badge variant="success">Completed</Badge>
          <span>{result.connectorDisplayName ?? result.connectorId}</span>
          <span>{result.statementKind ?? "read-only"}</span>
          <Badge variant={result.mockExecution ? "info" : "warning"}>
            {result.mockExecution ? "Mock" : "Experimental sidecar"}
          </Badge>
          {result.noSecretsReturned ? (
            <Badge variant="neutral">No secrets</Badge>
          ) : null}
          {result.noAiContextShared ? (
            <Badge variant="neutral">No AI sharing</Badge>
          ) : null}
        </div>
        <Button onClick={() => void handleCopyResults()} variant="secondary">
          Copy results
        </Button>
      </div>
      <div className="jdbc-result-summary" aria-label="Result summary">
        <span>{resultSummaryText(result)}</span>
        <span>{result.columns.length.toString()} columns</span>
        <span>{result.durationMs.toString()} ms</span>
        <span>{result.truncated ? "Truncated: yes" : "Truncated: no"}</span>
      </div>
      <div className="jdbc-result-limits" aria-label="Result limits">
        <span>Max rows {result.rowLimit.toString()}</span>
        <span>Timeout {timeoutMs.toString()} ms</span>
        <span>Max result bytes {formatBytes(maxResultBytes)}</span>
      </div>
      {result.truncated ? <JdbcTruncationNotice result={result} /> : null}
      <JdbcQueryResultTable result={result} />
      {copyMessage ? (
        <p className="jdbc-copy-feedback" role="status">
          {copyMessage}
        </p>
      ) : null}
    </div>
  );
}

function JdbcTruncationNotice({
  result,
}: {
  result: JdbcReadOnlyQueryResult;
}) {
  const caps = [
    result.truncatedRows ? "rows" : null,
    result.truncatedColumns ? "columns" : null,
    result.truncatedCells ? "cell values" : null,
    result.truncatedBytes ? "response size" : null,
  ].filter(Boolean);

  const capText = caps.length > 0 ? caps.join(", ") : "backend";

  return (
    <p className="jdbc-message jdbc-message-warning">
      Result capped by {capText} limits. Showing bounded sample only.
      {result.truncatedRows ? " Max rows cap reached." : ""}
    </p>
  );
}
