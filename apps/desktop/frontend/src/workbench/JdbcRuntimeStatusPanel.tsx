import { Badge } from "../design-system/Badge";
import type { JdbcConnector } from "../workspace/jdbcConnectorTypes";

export function JdbcRuntimeStatusPanel({
  selectedConnector,
}: {
  selectedConnector: JdbcConnector | null;
}) {
  return (
    <section
      aria-label="Connection / Runtime status"
      className="jdbc-runtime-status"
    >
      <div className="jdbc-sql-header">
        <div>
          <p className="jdbc-pane-title">Connection / Runtime status</p>
          <p className="jdbc-pane-subtitle">
            A selected connection profile is required. The current product
            runtime is the bounded mock read-only adapter.
          </p>
        </div>
        <div className="jdbc-summary-badges">
          <Badge variant={selectedConnector ? "success" : "warning"}>
            {selectedConnector ? "Profile selected" : "No profile"}
          </Badge>
          <Badge variant="info">Mock active</Badge>
        </div>
      </div>

      <div className="jdbc-runtime-grid">
        <div>
          <span className="jdbc-runtime-label">Profile</span>
          <span className="jdbc-runtime-value">
            {selectedConnector?.displayName || "Select or create a profile"}
          </span>
        </div>
        <div>
          <span className="jdbc-runtime-label">Connection</span>
          <span className="jdbc-runtime-value">
            No production database connection
          </span>
        </div>
        <div>
          <span className="jdbc-runtime-label">Execution</span>
          <span className="jdbc-runtime-value">Explicit operator run only</span>
        </div>
        <div>
          <span className="jdbc-runtime-label">AI / automation</span>
          <span className="jdbc-runtime-value">
            No hidden Workspace Agent SQL execution
          </span>
        </div>
      </div>

      <details className="jdbc-runtime-details">
        <summary>Runtime details</summary>
        <p>
          The desktop path validates ownership of this Database / JDBC widget,
          validates conservative read-only SQL, and then uses the mock adapter
          by default. Sidecar or real connector runtime remains unsupported/not
          configured for product use in this slice; visible runtime errors such
          as not_configured or unsupported_driver are shown in the result area.
        </p>
      </details>
    </section>
  );
}
