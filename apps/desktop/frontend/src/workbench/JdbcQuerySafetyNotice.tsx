export function JdbcQuerySafetyNotice() {
  return (
    <div className="jdbc-safety-notice" aria-label="Read-only safety notice">
      <p>
        The mock validator accepts SELECT, WITH, SHOW, DESCRIBE, and mock
        EXPLAIN wrappers. Experimental real sidecar execution accepts only
        SELECT or WITH. Writes, DDL/DML, stored procedures, session mutation,
        and multi-statement batches are rejected. Nothing runs until you
        validate the visible SQL and press Run read-only query.
      </p>
    </div>
  );
}
