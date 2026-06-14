import { useId } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import type { JdbcConnector } from "../workspace/jdbcConnectorTypes";
import type {
  JdbcConnectionProfile,
  JdbcReadOnlySqlValidation,
  JdbcSidecarDiagnostic,
} from "../workspace/jdbcQueryTypes";
import type { JdbcExperimentalRuntimeDraft } from "./jdbcConnectorWidgetModel";
import { JdbcQueryCopyActions } from "./JdbcQueryCopyActions";
import { JdbcQuerySafetyNotice } from "./JdbcQuerySafetyNotice";

export type ExperimentalRuntimeTextField =
  | "credentialEnvVarName"
  | "driverClassName"
  | "driverJarPath"
  | "javaProgram"
  | "jdbcUrl"
  | "sidecarClasspath"
  | "sidecarJarPath"
  | "sidecarMainClass"
  | "username";

type JdbcQueryEditorPanelProps = {
  connectionProfiles: JdbcConnectionProfile[];
  connectors: JdbcConnector[];
  deleteConfirmationArmed: boolean;
  experimentalRuntime: JdbcExperimentalRuntimeDraft;
  healthDiagnostic: JdbcSidecarDiagnostic | null;
  isCheckingHealth: boolean;
  isConnectorSelectionDisabled: boolean;
  isDeletingProfile: boolean;
  isLoadingProfiles: boolean;
  isProbingDriver: boolean;
  isRunning: boolean;
  isSavingProfile: boolean;
  isValidating: boolean;
  isValidationCurrent: boolean;
  maxResultBytes: number;
  maxResultBytesCap: number;
  maxRowLimit: number;
  onCheckSidecar: () => void;
  onCopyQuery: () => void;
  onDeleteProfile: () => void;
  onExperimentalEnabledChange: (enabled: boolean) => void;
  onMaxResultBytesChange: (value: number) => void;
  onProbeDriver: () => void;
  onProfileDescriptionChange: (value: string) => void;
  onProfileNameChange: (value: string) => void;
  onRowLimitChange: (value: number) => void;
  onRun: () => void;
  onRuntimeFieldChange: (
    field: ExperimentalRuntimeTextField,
    value: string,
  ) => void;
  onSaveAsNewProfile: () => void;
  onSaveProfile: () => void;
  onSelectConnector: (connectorId: string) => void;
  onSelectProfile: (profileId: string) => void;
  onSqlChange: (value: string) => void;
  onTimeoutMsChange: (value: number) => void;
  onValidate: () => void;
  profileApiAvailable: boolean;
  profileDescription: string;
  profileError: string | null;
  profileMessage: string | null;
  profileName: string;
  queryCopyMessage: string | null;
  rowLimit: number;
  runBlockedReason: string | null;
  selectedConnectorId: string;
  selectedProfile: JdbcConnectionProfile | null;
  selectedProfileDirty: boolean;
  sql: string;
  timeoutCapMs: number;
  timeoutMs: number;
  trimmedSql: string;
  validation: JdbcReadOnlySqlValidation | null | undefined;
  driverDiagnostic: JdbcSidecarDiagnostic | null;
};

export function JdbcQueryEditorPanel({
  connectionProfiles,
  connectors,
  deleteConfirmationArmed,
  driverDiagnostic,
  experimentalRuntime,
  healthDiagnostic,
  isCheckingHealth,
  isConnectorSelectionDisabled,
  isDeletingProfile,
  isLoadingProfiles,
  isProbingDriver,
  isRunning,
  isSavingProfile,
  isValidating,
  isValidationCurrent,
  maxResultBytes,
  maxResultBytesCap,
  maxRowLimit,
  onCheckSidecar,
  onCopyQuery,
  onDeleteProfile,
  onExperimentalEnabledChange,
  onMaxResultBytesChange,
  onProbeDriver,
  onProfileDescriptionChange,
  onProfileNameChange,
  onRowLimitChange,
  onRun,
  onRuntimeFieldChange,
  onSaveAsNewProfile,
  onSaveProfile,
  onSelectConnector,
  onSelectProfile,
  onSqlChange,
  onTimeoutMsChange,
  onValidate,
  profileApiAvailable,
  profileDescription,
  profileError,
  profileMessage,
  profileName,
  queryCopyMessage,
  rowLimit,
  runBlockedReason,
  selectedConnectorId,
  selectedProfile,
  selectedProfileDirty,
  sql,
  timeoutCapMs,
  timeoutMs,
  trimmedSql,
  validation,
}: JdbcQueryEditorPanelProps) {
  const connectorInputId = useId();
  const rowLimitInputId = useId();
  const timeoutInputId = useId();
  const maxResultBytesInputId = useId();
  const sqlInputId = useId();
  const experimentalEnabledInputId = useId();
  const javaProgramInputId = useId();
  const sidecarJarPathInputId = useId();
  const sidecarClasspathInputId = useId();
  const sidecarMainClassInputId = useId();
  const driverJarPathInputId = useId();
  const driverClassNameInputId = useId();
  const jdbcUrlInputId = useId();
  const usernameInputId = useId();
  const credentialEnvVarNameInputId = useId();
  const profileSelectInputId = useId();
  const profileNameInputId = useId();
  const profileDescriptionInputId = useId();

  return (
    <>
      <div className="jdbc-sql-header">
        <div>
          <p className="jdbc-pane-title">Query editor</p>
          <p className="jdbc-pane-subtitle">
            Operator-triggered mock execution only. Workspace Agent suggestions
            can be copied here, but Workspace Agent cannot run SQL.
          </p>
        </div>
        <div className="jdbc-summary-badges">
          <Badge variant={experimentalRuntime.enabled ? "warning" : "info"}>
            {experimentalRuntime.enabled
              ? "Experimental sidecar"
              : "Mock execution"}
          </Badge>
          <Badge variant="success">Read-only</Badge>
        </div>
      </div>

      <JdbcQuerySafetyNotice />

      <div className="jdbc-query-controls">
        <label className="jdbc-field" htmlFor={connectorInputId}>
          <span className="field-label">Connection profile</span>
          <select
            className="select"
            disabled={isConnectorSelectionDisabled || connectors.length === 0}
            id={connectorInputId}
            onChange={(event) => {
              const connectorId = event.currentTarget.value;
              if (connectorId) {
                onSelectConnector(connectorId);
              }
            }}
            value={selectedConnectorId}
          >
            <option value="">Select connector</option>
            {connectors.map((connector) => (
              <option key={connector.connectorId} value={connector.connectorId}>
                {connector.displayName || "Untitled connector"}
              </option>
            ))}
          </select>
        </label>
        <label
          className="jdbc-field jdbc-query-limit-field"
          htmlFor={rowLimitInputId}
        >
          <span className="field-label">Row limit</span>
          <input
            className="input"
            id={rowLimitInputId}
            max={maxRowLimit}
            min={1}
            onChange={(event) =>
              onRowLimitChange(Number(event.currentTarget.value))
            }
            type="number"
            value={rowLimit}
          />
          <span className="jdbc-query-hint">Backend cap: 100 rows</span>
        </label>
        <label
          className="jdbc-field jdbc-query-limit-field"
          htmlFor={timeoutInputId}
        >
          <span className="field-label">Timeout ms</span>
          <input
            className="input"
            id={timeoutInputId}
            max={timeoutCapMs}
            min={1}
            onChange={(event) =>
              onTimeoutMsChange(Number(event.currentTarget.value))
            }
            type="number"
            value={timeoutMs}
          />
          <span className="jdbc-query-hint">Backend cap: 10000 ms</span>
        </label>
        <label
          className="jdbc-field jdbc-query-limit-field"
          htmlFor={maxResultBytesInputId}
        >
          <span className="field-label">Max result bytes</span>
          <input
            className="input"
            id={maxResultBytesInputId}
            max={maxResultBytesCap}
            min={1}
            onChange={(event) =>
              onMaxResultBytesChange(Number(event.currentTarget.value))
            }
            type="number"
            value={maxResultBytes}
          />
          <span className="jdbc-query-hint">Backend cap: 256 KiB</span>
        </label>
      </div>

      <details className="jdbc-experimental-runtime">
        <summary>
          <span>Experimental sidecar runtime</span>
        </summary>
        <div className="jdbc-experimental-copy">
          <p>
            Opt-in only. Real JDBC requires an explicit sidecar classpath or
            JAR, explicit driver JAR, explicit JDBC URL, and explicit Run. Saved
            profiles store non-secret metadata only. Enter a password
            environment variable name only; never enter a password value.
          </p>
        </div>
        <section
          aria-label="Experimental JDBC connection profiles"
          className="jdbc-profile-panel"
        >
          <div className="jdbc-profile-header">
            <div>
              <p className="jdbc-pane-title">Connection profiles</p>
            </div>
            <Badge variant={selectedProfileDirty ? "warning" : "neutral"}>
              {selectedProfileDirty ? "Unsaved changes" : "No auto-run"}
            </Badge>
          </div>
          <div className="jdbc-profile-grid">
            <label className="jdbc-field" htmlFor={profileSelectInputId}>
              <span className="field-label">Saved profile</span>
              <select
                className="select"
                disabled={!profileApiAvailable || isLoadingProfiles}
                id={profileSelectInputId}
                onChange={(event) => onSelectProfile(event.currentTarget.value)}
                value={selectedProfile?.profileId ?? ""}
              >
                <option value="">
                  {isLoadingProfiles ? "Loading profiles" : "Select profile"}
                </option>
                {connectionProfiles.map((profile) => (
                  <option key={profile.profileId} value={profile.profileId}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="jdbc-field" htmlFor={profileNameInputId}>
              <span className="field-label">Profile name</span>
              <input
                className="input"
                id={profileNameInputId}
                onChange={(event) =>
                  onProfileNameChange(event.currentTarget.value)
                }
                placeholder="Analytics readonly"
                value={profileName}
              />
            </label>
            <label
              className="jdbc-field jdbc-field-wide"
              htmlFor={profileDescriptionInputId}
            >
              <span className="field-label">Description</span>
              <input
                className="input"
                id={profileDescriptionInputId}
                onChange={(event) =>
                  onProfileDescriptionChange(event.currentTarget.value)
                }
                value={profileDescription}
              />
            </label>
          </div>
          <div className="jdbc-profile-actions">
            <Button
              disabled={!selectedProfile || !selectedProfileDirty || isSavingProfile}
              onClick={onSaveProfile}
              variant="primary"
            >
              {isSavingProfile && selectedProfile ? "Saving" : "Save profile"}
            </Button>
            <Button
              disabled={!profileApiAvailable || isSavingProfile}
              onClick={onSaveAsNewProfile}
              variant="secondary"
            >
              Save as new profile
            </Button>
            <Button
              disabled={!selectedProfile || isDeletingProfile}
              onClick={onDeleteProfile}
              variant="ghost"
            >
              {deleteConfirmationArmed ? "Confirm delete" : "Delete profile"}
            </Button>
          </div>
          {profileMessage ? (
            <p className="jdbc-message jdbc-message-warning">{profileMessage}</p>
          ) : null}
          {profileError ? (
            <p className="jdbc-message jdbc-message-error" role="alert">
              {profileError}
            </p>
          ) : null}
        </section>
        <label
          className="jdbc-readonly-toggle"
          htmlFor={experimentalEnabledInputId}
        >
          <input
            checked={experimentalRuntime.enabled}
            id={experimentalEnabledInputId}
            onChange={(event) =>
              onExperimentalEnabledChange(event.currentTarget.checked)
            }
            type="checkbox"
          />
          Enable experimental real JDBC sidecar for the next Run
        </label>
        <div className="jdbc-experimental-grid">
          <label className="jdbc-field" htmlFor={javaProgramInputId}>
            <span className="field-label">Java executable</span>
            <input
              className="input"
              id={javaProgramInputId}
              onChange={(event) =>
                onRuntimeFieldChange("javaProgram", event.currentTarget.value)
              }
              value={experimentalRuntime.javaProgram}
            />
          </label>
          <label className="jdbc-field" htmlFor={sidecarJarPathInputId}>
            <span className="field-label">Sidecar JAR path</span>
            <input
              className="input"
              id={sidecarJarPathInputId}
              onChange={(event) =>
                onRuntimeFieldChange(
                  "sidecarJarPath",
                  event.currentTarget.value,
                )
              }
              placeholder="C:\\path\\to\\jdbc-readonly-sidecar.jar"
              value={experimentalRuntime.sidecarJarPath}
            />
          </label>
          <label className="jdbc-field" htmlFor={sidecarClasspathInputId}>
            <span className="field-label">Sidecar classpath or classes dir</span>
            <input
              className="input"
              id={sidecarClasspathInputId}
              onChange={(event) =>
                onRuntimeFieldChange(
                  "sidecarClasspath",
                  event.currentTarget.value,
                )
              }
              placeholder="target/hobit-jdbc-sidecar/classes"
              value={experimentalRuntime.sidecarClasspath}
            />
          </label>
          <label className="jdbc-field" htmlFor={sidecarMainClassInputId}>
            <span className="field-label">Sidecar main class</span>
            <input
              className="input"
              id={sidecarMainClassInputId}
              onChange={(event) =>
                onRuntimeFieldChange(
                  "sidecarMainClass",
                  event.currentTarget.value,
                )
              }
              value={experimentalRuntime.sidecarMainClass}
            />
          </label>
          <label className="jdbc-field" htmlFor={driverJarPathInputId}>
            <span className="field-label">Driver JAR path</span>
            <input
              className="input"
              id={driverJarPathInputId}
              onChange={(event) =>
                onRuntimeFieldChange(
                  "driverJarPath",
                  event.currentTarget.value,
                )
              }
              placeholder="C:\\path\\to\\driver.jar"
              value={experimentalRuntime.driverJarPath}
            />
          </label>
          <label className="jdbc-field" htmlFor={driverClassNameInputId}>
            <span className="field-label">Driver class</span>
            <input
              className="input"
              id={driverClassNameInputId}
              onChange={(event) =>
                onRuntimeFieldChange(
                  "driverClassName",
                  event.currentTarget.value,
                )
              }
              placeholder="org.postgresql.Driver"
              value={experimentalRuntime.driverClassName}
            />
          </label>
          <label className="jdbc-field" htmlFor={jdbcUrlInputId}>
            <span className="field-label">Runtime JDBC URL</span>
            <input
              className="input"
              id={jdbcUrlInputId}
              onChange={(event) =>
                onRuntimeFieldChange("jdbcUrl", event.currentTarget.value)
              }
              placeholder="jdbc:postgresql://localhost/app"
              value={experimentalRuntime.jdbcUrl}
            />
          </label>
          <label className="jdbc-field" htmlFor={usernameInputId}>
            <span className="field-label">Username</span>
            <input
              className="input"
              id={usernameInputId}
              onChange={(event) =>
                onRuntimeFieldChange("username", event.currentTarget.value)
              }
              value={experimentalRuntime.username}
            />
          </label>
          <label className="jdbc-field" htmlFor={credentialEnvVarNameInputId}>
            <span className="field-label">Password env var name</span>
            <input
              className="input"
              id={credentialEnvVarNameInputId}
              onChange={(event) =>
                onRuntimeFieldChange(
                  "credentialEnvVarName",
                  event.currentTarget.value,
                )
              }
              placeholder="HOBIT_READONLY_DB_PASSWORD"
              value={experimentalRuntime.credentialEnvVarName}
            />
          </label>
        </div>
        <section className="jdbc-diagnostics" aria-label="Runtime diagnostics">
          <div className="jdbc-sql-header">
            <div>
              <p className="jdbc-pane-title">Runtime diagnostics</p>
            </div>
          </div>
          <div className="jdbc-diagnostic-actions">
            <Button
              disabled={isCheckingHealth || isRunning}
              onClick={onCheckSidecar}
              variant="secondary"
            >
              {isCheckingHealth ? "Checking" : "Check sidecar"}
            </Button>
            <Button
              disabled={isProbingDriver || isRunning}
              onClick={onProbeDriver}
              variant="secondary"
            >
              {isProbingDriver ? "Probing" : "Probe driver"}
            </Button>
          </div>
          <div className="jdbc-diagnostic-status-grid">
            <JdbcDiagnosticStatus diagnostic={healthDiagnostic} label="Sidecar" />
            <JdbcDiagnosticStatus diagnostic={driverDiagnostic} label="Driver" />
          </div>
        </section>
      </details>

      <label className="jdbc-field jdbc-field-wide" htmlFor={sqlInputId}>
        <span className="field-label">SQL</span>
        <textarea
          className="input jdbc-sql-editor"
          id={sqlInputId}
          onChange={(event) => onSqlChange(event.currentTarget.value)}
          placeholder="select 1"
          value={sql}
        />
      </label>

      <JdbcQueryCopyActions
        isRunning={isRunning}
        isValidating={isValidating}
        isValidationCurrent={isValidationCurrent}
        onCopyQuery={onCopyQuery}
        onRun={onRun}
        onValidate={onValidate}
        runBlockedReason={runBlockedReason}
        trimmedSql={trimmedSql}
        validation={validation}
      />

      {queryCopyMessage ? (
        <p className="jdbc-copy-feedback" role="status">
          {queryCopyMessage}
        </p>
      ) : null}
    </>
  );
}

function JdbcDiagnosticStatus({
  diagnostic,
  label,
}: {
  diagnostic: JdbcSidecarDiagnostic | null;
  label: string;
}) {
  if (!diagnostic) {
    return (
      <div className="jdbc-diagnostic-status">
        <span className="jdbc-runtime-label">{label}</span>
        <span className="jdbc-runtime-value">Not checked</span>
      </div>
    );
  }

  return (
    <div className="jdbc-diagnostic-status">
      <span className="jdbc-runtime-label">{label}</span>
      <span className="jdbc-runtime-value">
        <Badge variant={diagnostic.ok ? "success" : "error"}>
          {diagnostic.ok ? "OK" : "Failed"}
        </Badge>
        <span>{diagnostic.message}</span>
      </span>
      <details className="jdbc-diagnostic-details">
        <summary>{diagnostic.ok ? "Details" : "Error details"}</summary>
        <p>{diagnostic.details ?? diagnostic.status}</p>
      </details>
    </div>
  );
}
