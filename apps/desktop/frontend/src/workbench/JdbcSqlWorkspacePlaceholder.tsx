import { Button } from "../design-system/Button";

export function JdbcSqlWorkspacePlaceholder() {
  return (
    <section
      aria-label="Future SQL workspace"
      className="jdbc-sql-placeholder"
    >
      <div className="jdbc-sql-header">
        <div>
          <p className="jdbc-pane-title">SQL workspace</p>
          <p className="jdbc-pane-subtitle">
            SQL execution is not implemented yet. EXPLAIN, result grid,
            formatting, and AI SQL assistance are future work.
          </p>
        </div>
        <div className="jdbc-sql-actions">
          <Button disabled variant="ghost">
            Format SQL
          </Button>
          <Button disabled variant="secondary">
            Explain
          </Button>
          <Button disabled variant="primary">
            Run
          </Button>
        </div>
      </div>
      <textarea
        className="input jdbc-sql-editor"
        disabled
        placeholder="Future read-only SQL editor. No query execution is available in this version."
      />
      <div className="jdbc-results-placeholder">
        <p className="jdbc-empty-title">Results pending implementation.</p>
        <p className="jdbc-empty-text">
          Future Coordinator Chat will use this widget as a controlled database
          proxy through approved read-only capabilities.
        </p>
      </div>
    </section>
  );
}
