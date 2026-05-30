import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import type { JdbcReadOnlySqlValidation } from "../workspace/jdbcQueryTypes";

export function JdbcQueryCopyActions({
  isRunning,
  isValidating,
  isValidationCurrent,
  onCopyQuery,
  onRun,
  onValidate,
  runBlockedReason,
  trimmedSql,
  validation,
}: {
  isRunning: boolean;
  isValidating: boolean;
  isValidationCurrent: boolean;
  onCopyQuery: () => void;
  onRun: () => void;
  onValidate: () => void;
  runBlockedReason: string | null;
  trimmedSql: string;
  validation: JdbcReadOnlySqlValidation | null | undefined;
}) {
  return (
    <div className="jdbc-query-actions">
      <JdbcValidationStatus
        isValidationCurrent={isValidationCurrent}
        validation={validation}
      />
      <div className="jdbc-sql-actions">
        <Button disabled={!trimmedSql} onClick={onCopyQuery} variant="ghost">
          Copy SQL
        </Button>
        <Button
          disabled={isValidating || isRunning}
          onClick={onValidate}
          variant="secondary"
        >
          {isValidating ? "Validating" : "Validate SQL"}
        </Button>
        <Button
          disabled={Boolean(runBlockedReason) || isRunning}
          onClick={onRun}
          title={runBlockedReason ?? undefined}
          variant="primary"
        >
          {isRunning ? "Running" : "Run read-only query"}
        </Button>
      </div>
    </div>
  );
}

function JdbcValidationStatus({
  isValidationCurrent,
  validation,
}: {
  isValidationCurrent: boolean;
  validation: JdbcReadOnlySqlValidation | null | undefined;
}) {
  if (!validation) {
    return (
      <div className="jdbc-validation-status">
        <Badge variant="neutral">Review</Badge>
        <span>Validate SQL before running.</span>
      </div>
    );
  }

  if (!isValidationCurrent) {
    return (
      <div className="jdbc-validation-status jdbc-validation-warning">
        <Badge variant="warning">Stale</Badge>
        <span>SQL, connector, or row limit changed after validation.</span>
      </div>
    );
  }

  return (
    <div
      className={
        validation.isValid
          ? "jdbc-validation-status jdbc-validation-valid"
          : "jdbc-validation-status jdbc-validation-error"
      }
    >
      <Badge variant={validation.isValid ? "success" : "error"}>
        {validation.isValid ? "Valid" : "Rejected"}
      </Badge>
      <span>
        {validation.isValid
          ? `${validation.statementKind ?? "Read-only"} statement accepted.`
          : validation.rejectionReason ??
            "SQL did not pass read-only validation."}
      </span>
    </div>
  );
}
