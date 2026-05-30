import { Button } from "../design-system/Button";
import type { JdbcReadOnlyQueryResult } from "../workspace/jdbcQueryTypes";
import {
  compactErrorSummary,
  copyTextToClipboard,
  errorDetailsText,
  redactJdbcText,
} from "./jdbcQueryResultFormatters";

export function JdbcQueryErrorPanel({
  copyMessage,
  onCopyMessageChange,
  result,
}: {
  copyMessage: string | null;
  onCopyMessageChange: (message: string) => void;
  result: JdbcReadOnlyQueryResult;
}) {
  const redactedError = result.sanitizedError
    ? redactJdbcText(result.sanitizedError)
    : null;
  const redactedRejection = result.validation.rejectionReason
    ? redactJdbcText(result.validation.rejectionReason)
    : null;

  async function handleCopyError() {
    const copied = await copyTextToClipboard(errorDetailsText(result));
    onCopyMessageChange(copied ? "Error details copied." : "Copy failed.");
  }

  return (
    <div className="jdbc-query-error-panel" role="alert">
      <div className="jdbc-result-toolbar">
        <div>
          <p className="jdbc-empty-title">
            Read-only query stopped: {result.status}
          </p>
          <p className="jdbc-empty-text">
            {compactErrorSummary(
              redactedError ??
                redactedRejection ??
                `Backend returned status ${result.status}.`,
            )}
          </p>
        </div>
        <Button onClick={() => void handleCopyError()} variant="ghost">
          Copy error
        </Button>
      </div>
      <details className="jdbc-error-details">
        <summary>Error details</summary>
        <p>{errorDetailsText(result)}</p>
      </details>
      <p className="jdbc-empty-text">
        No database write, hidden execution, or AI result sharing occurred.
      </p>
      {copyMessage ? (
        <p className="jdbc-copy-feedback" role="status">
          {copyMessage}
        </p>
      ) : null}
    </div>
  );
}
