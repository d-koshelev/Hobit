import { Badge } from "../design-system/Badge";

export function JdbcConnectorHeader() {
  return (
    <section className="jdbc-summary">
      <div className="jdbc-summary-copy">
        <p className="jdbc-eyebrow">Database / JDBC</p>
        <p className="jdbc-summary-text">
          Create an explicit workspace-local connection profile, review the
          visible SQL, and run only bounded read-only mock queries from this
          widget. Real database connections, credentials, and AI result sharing
          are not enabled.
        </p>
      </div>
      <div className="jdbc-summary-badges">
        <Badge variant="info">Mock read-only</Badge>
        <Badge variant="warning">No secrets</Badge>
      </div>
    </section>
  );
}
