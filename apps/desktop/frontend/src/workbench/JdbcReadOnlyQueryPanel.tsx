import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import type { JdbcConnector } from "../workspace/jdbcConnectorTypes";
import type {
  JdbcConnectionProfile,
  JdbcReadOnlyQueryResult,
  JdbcReadOnlySqlValidation,
  JdbcSidecarDiagnostic,
} from "../workspace/jdbcQueryTypes";
import type {
  JdbcConnectionProfileCreateRequest,
  JdbcConnectionProfileDeleteRequest,
  JdbcConnectionProfileUpdateRequest,
  JdbcDriverProbeRequest,
  JdbcReadOnlyQueryExecutionRequest,
  JdbcReadOnlySqlValidationRequest,
  JdbcSidecarHealthCheckRequest,
} from "./jdbcConnectorWidgetActions";
import {
  errorToMessage,
  type JdbcExperimentalRuntimeDraft,
} from "./jdbcConnectorWidgetModel";

type JdbcReadOnlyQueryPanelProps = {
  connectors: JdbcConnector[];
  isConnectorSelectionDisabled?: boolean;
  onCheckSidecarHealth?: (
    request: JdbcSidecarHealthCheckRequest,
  ) => Promise<JdbcSidecarDiagnostic>;
  onCreateConnectionProfile?: (
    request: JdbcConnectionProfileCreateRequest,
  ) => Promise<JdbcConnectionProfile>;
  onDeleteConnectionProfile?: (
    request: JdbcConnectionProfileDeleteRequest,
  ) => Promise<boolean>;
  onExecuteQuery?: (
    request: JdbcReadOnlyQueryExecutionRequest,
  ) => Promise<JdbcReadOnlyQueryResult>;
  onListConnectionProfiles?: () => Promise<JdbcConnectionProfile[]>;
  onProbeDriver?: (
    request: JdbcDriverProbeRequest,
  ) => Promise<JdbcSidecarDiagnostic>;
  onSelectConnector: (connectorId: string) => Promise<void> | void;
  onUpdateConnectionProfile?: (
    request: JdbcConnectionProfileUpdateRequest,
  ) => Promise<JdbcConnectionProfile | null>;
  onValidateSql?: (
    request: JdbcReadOnlySqlValidationRequest,
  ) => Promise<JdbcReadOnlySqlValidation>;
  selectedConnector: JdbcConnector | null;
};

type ValidationSnapshot = {
  connectorId: string;
  rowLimit: number;
  sql: string;
  validation: JdbcReadOnlySqlValidation;
};

type ResultCapsSnapshot = {
  maxResultBytes: number;
  timeoutMs: number;
};

type ExperimentalRuntimeTextField =
  | "credentialEnvVarName"
  | "driverClassName"
  | "driverJarPath"
  | "javaProgram"
  | "jdbcUrl"
  | "sidecarClasspath"
  | "sidecarJarPath"
  | "sidecarMainClass"
  | "username";

const DEFAULT_ROW_LIMIT = 100;
const MAX_ROW_LIMIT = 100;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RESULT_BYTES = 256 * 1024;
const DEFAULT_SIDECAR_MAIN_CLASS = "com.hobit.jdbc.JdbcReadOnlySidecar";

export function JdbcReadOnlyQueryPanel({
  connectors,
  isConnectorSelectionDisabled = false,
  onCheckSidecarHealth,
  onCreateConnectionProfile,
  onDeleteConnectionProfile,
  onExecuteQuery,
  onListConnectionProfiles,
  onProbeDriver,
  onSelectConnector,
  onUpdateConnectionProfile,
  onValidateSql,
  selectedConnector,
}: JdbcReadOnlyQueryPanelProps) {
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
  const [sql, setSql] = useState("select 1");
  const [rowLimit, setRowLimit] = useState(DEFAULT_ROW_LIMIT);
  const [timeoutMs, setTimeoutMs] = useState(DEFAULT_TIMEOUT_MS);
  const [maxResultBytes, setMaxResultBytes] = useState(DEFAULT_MAX_RESULT_BYTES);
  const [experimentalRuntime, setExperimentalRuntime] =
    useState<JdbcExperimentalRuntimeDraft>({
      credentialEnvVarName: "",
      driverClassName: "",
      driverJarPath: "",
      enabled: false,
      javaProgram: "java",
      jdbcUrl: "",
      maxResultBytes: DEFAULT_MAX_RESULT_BYTES,
      maxRows: DEFAULT_ROW_LIMIT,
      sidecarClasspath: "",
      sidecarJarPath: "",
      sidecarMainClass: DEFAULT_SIDECAR_MAIN_CLASS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
      username: "",
    });
  const [connectionProfiles, setConnectionProfiles] = useState<
    JdbcConnectionProfile[]
  >([]);
  const [selectedProfile, setSelectedProfile] =
    useState<JdbcConnectionProfile | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileDescription, setProfileDescription] = useState("");
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isDeletingProfile, setIsDeletingProfile] = useState(false);
  const [deleteConfirmationArmed, setDeleteConfirmationArmed] = useState(false);
  const [validationSnapshot, setValidationSnapshot] =
    useState<ValidationSnapshot | null>(null);
  const [result, setResult] = useState<JdbcReadOnlyQueryResult | null>(null);
  const [resultCaps, setResultCaps] = useState<ResultCapsSnapshot | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [healthDiagnostic, setHealthDiagnostic] =
    useState<JdbcSidecarDiagnostic | null>(null);
  const [driverDiagnostic, setDriverDiagnostic] =
    useState<JdbcSidecarDiagnostic | null>(null);
  const [queryCopyMessage, setQueryCopyMessage] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [isProbingDriver, setIsProbingDriver] = useState(false);

  const trimmedSql = sql.trim();
  const normalizedRowLimit = clampRowLimit(rowLimit);
  const normalizedTimeoutMs = clampTimeoutMs(timeoutMs);
  const normalizedMaxResultBytes = clampMaxResultBytes(maxResultBytes);
  const selectedConnectorId = selectedConnector?.connectorId ?? "";
  const isValidationCurrent = Boolean(
    validationSnapshot &&
      validationSnapshot.sql === trimmedSql &&
      validationSnapshot.connectorId === selectedConnectorId &&
      validationSnapshot.rowLimit === normalizedRowLimit,
  );
  const currentValidation = isValidationCurrent
    ? validationSnapshot?.validation
    : null;
  const runBlockedReason = useMemo(
    () =>
      describeRunBlocker({
        currentValidation,
        hasExecuteApi: Boolean(onExecuteQuery),
        isValidationCurrent,
        selectedConnector,
        trimmedSql,
      }),
    [
      currentValidation,
      isValidationCurrent,
      onExecuteQuery,
      selectedConnector,
      trimmedSql,
    ],
  );
  const selectedProfileDirty = Boolean(
    selectedProfile &&
      (profileName !== selectedProfile.name ||
        profileDescription !== selectedProfile.description ||
        experimentalRuntime.driverJarPath !== selectedProfile.driverJarPath ||
        experimentalRuntime.driverClassName !== selectedProfile.driverClassName ||
        experimentalRuntime.jdbcUrl !== selectedProfile.jdbcUrl ||
        nullToEmpty(selectedProfile.username) !== experimentalRuntime.username ||
        nullToEmpty(selectedProfile.passwordEnvVarName) !==
          experimentalRuntime.credentialEnvVarName ||
        rowLimit !== selectedProfile.maxRows ||
        timeoutMs !== selectedProfile.timeoutMs ||
        maxResultBytes !== selectedProfile.maxResultBytes),
  );
  const profileApiAvailable = Boolean(
    onCreateConnectionProfile &&
      onListConnectionProfiles &&
      onUpdateConnectionProfile &&
      onDeleteConnectionProfile,
  );

  const loadConnectionProfiles = useCallback(async () => {
    if (!onListConnectionProfiles) {
      setConnectionProfiles([]);
      return;
    }

    setIsLoadingProfiles(true);
    setProfileError(null);

    try {
      const profiles = await onListConnectionProfiles();
      setConnectionProfiles(profiles);
      setSelectedProfile((currentProfile) => {
        if (!currentProfile) {
          return null;
        }

        return (
          profiles.find(
            (profile) => profile.profileId === currentProfile.profileId,
          ) ?? null
        );
      });
    } catch (error) {
      setConnectionProfiles([]);
      setProfileError(
        errorToMessage(error, "Unable to load JDBC connection profiles."),
      );
    } finally {
      setIsLoadingProfiles(false);
    }
  }, [onListConnectionProfiles]);

  useEffect(() => {
    void loadConnectionProfiles();
  }, [loadConnectionProfiles]);

  async function handleSelectProfile(profileId: string) {
    setDeleteConfirmationArmed(false);
    setProfileMessage(null);
    setProfileError(null);

    const profile =
      connectionProfiles.find((candidate) => candidate.profileId === profileId) ??
      null;
    setSelectedProfile(profile);

    if (!profile) {
      return;
    }

    applyProfileToDraft(profile);
  }

  async function handleSaveProfile() {
    if (!selectedProfile || !onUpdateConnectionProfile || isSavingProfile) {
      return;
    }

    const request = profileRequest();
    const validationError = validateProfileRequest(request);
    if (validationError) {
      setProfileError(validationError);
      setProfileMessage(null);
      return;
    }

    setIsSavingProfile(true);
    setProfileError(null);
    setProfileMessage(null);

    try {
      const updatedProfile = await onUpdateConnectionProfile({
        ...request,
        profileId: selectedProfile.profileId,
        readOnly: true,
      });

      if (!updatedProfile) {
        setProfileError("The selected JDBC connection profile could not be found.");
        return;
      }

      setSelectedProfile(updatedProfile);
      setProfileName(updatedProfile.name);
      setProfileDescription(updatedProfile.description);
      setConnectionProfiles((currentProfiles) =>
        currentProfiles.map((profile) =>
          profile.profileId === updatedProfile.profileId
            ? updatedProfile
            : profile,
        ),
      );
      setProfileMessage("Profile saved. Select does not connect or run.");
    } catch (error) {
      setProfileError(
        errorToMessage(error, "Unable to save JDBC connection profile."),
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleSaveAsNewProfile() {
    if (!onCreateConnectionProfile || isSavingProfile) {
      return;
    }

    const request = profileRequest();
    const validationError = validateProfileRequest(request);
    if (validationError) {
      setProfileError(validationError);
      setProfileMessage(null);
      return;
    }

    setIsSavingProfile(true);
    setProfileError(null);
    setProfileMessage(null);

    try {
      const createdProfile = await onCreateConnectionProfile(request);
      setSelectedProfile(createdProfile);
      setProfileName(createdProfile.name);
      setProfileDescription(createdProfile.description);
      setConnectionProfiles((currentProfiles) => [
        createdProfile,
        ...currentProfiles.filter(
          (profile) => profile.profileId !== createdProfile.profileId,
        ),
      ]);
      setProfileMessage("Profile saved. Select does not connect or run.");
    } catch (error) {
      setProfileError(
        errorToMessage(error, "Unable to save JDBC connection profile."),
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleDeleteProfile() {
    if (!selectedProfile || !onDeleteConnectionProfile || isDeletingProfile) {
      return;
    }

    if (!deleteConfirmationArmed) {
      setDeleteConfirmationArmed(true);
      setProfileMessage("Click Confirm delete to remove this profile.");
      setProfileError(null);
      return;
    }

    setIsDeletingProfile(true);
    setProfileError(null);
    setProfileMessage(null);

    try {
      const deleted = await onDeleteConnectionProfile({
        profileId: selectedProfile.profileId,
      });

      if (!deleted) {
        setProfileError("The selected JDBC connection profile could not be found.");
        return;
      }

      setConnectionProfiles((currentProfiles) =>
        currentProfiles.filter(
          (profile) => profile.profileId !== selectedProfile.profileId,
        ),
      );
      setSelectedProfile(null);
      setProfileName("");
      setProfileDescription("");
      setDeleteConfirmationArmed(false);
      setProfileMessage("Profile deleted.");
    } catch (error) {
      setProfileError(
        errorToMessage(error, "Unable to delete JDBC connection profile."),
      );
    } finally {
      setIsDeletingProfile(false);
    }
  }

  async function handleValidate() {
    if (!selectedConnector) {
      setPanelError("Select a connector before validating SQL.");
      return;
    }

    if (!trimmedSql) {
      setPanelError("Enter SQL before validation.");
      return;
    }

    if (!onValidateSql) {
      setPanelError(
        "JDBC SQL validation is unavailable in this runtime.",
      );
      return;
    }

    setIsValidating(true);
    setPanelError(null);
    setResult(null);
    setResultCaps(null);

    try {
      const validation = await onValidateSql({
        connectorId: selectedConnector.connectorId,
        rowLimit: normalizedRowLimit,
        sql: trimmedSql,
        timeoutMs: normalizedTimeoutMs,
      });
      setValidationSnapshot({
        connectorId: selectedConnector.connectorId,
        rowLimit: normalizedRowLimit,
        sql: trimmedSql,
        validation,
      });
    } catch (error) {
      setPanelError(errorToMessage(error, "Unable to validate JDBC SQL."));
    } finally {
      setIsValidating(false);
    }
  }

  async function handleRun() {
    if (!selectedConnector || runBlockedReason || !onExecuteQuery) {
      setPanelError(runBlockedReason ?? "JDBC query execution is unavailable.");
      return;
    }

    setIsRunning(true);
    setPanelError(null);

    try {
      const executionResult = await onExecuteQuery({
        connectorId: selectedConnector.connectorId,
        experimentalSidecar: experimentalRuntime.enabled
          ? runtimeRequest()
          : null,
        maxResultBytes: normalizedMaxResultBytes,
        rowLimit: normalizedRowLimit,
        sql: trimmedSql,
        timeoutMs: normalizedTimeoutMs,
      });
      setResult(executionResult);
      setResultCaps({
        maxResultBytes: normalizedMaxResultBytes,
        timeoutMs: normalizedTimeoutMs,
      });
      setValidationSnapshot({
        connectorId: selectedConnector.connectorId,
        rowLimit: normalizedRowLimit,
        sql: trimmedSql,
        validation: executionResult.validation,
      });
    } catch (error) {
      setPanelError(
        errorToMessage(error, "Unable to run JDBC read-only query."),
      );
    } finally {
      setIsRunning(false);
    }
  }

  async function handleCheckSidecar() {
    if (!onCheckSidecarHealth) {
      setPanelError("JDBC sidecar diagnostics are unavailable in this runtime.");
      return;
    }

    setIsCheckingHealth(true);
    setPanelError(null);

    try {
      const diagnostic = await onCheckSidecarHealth({
        experimentalSidecar: runtimeRequest(),
      });
      setHealthDiagnostic(diagnostic);
    } catch (error) {
      setPanelError(
        errorToMessage(error, "Unable to check JDBC sidecar health."),
      );
    } finally {
      setIsCheckingHealth(false);
    }
  }

  async function handleProbeDriver() {
    if (!onProbeDriver) {
      setPanelError("JDBC driver diagnostics are unavailable in this runtime.");
      return;
    }

    setIsProbingDriver(true);
    setPanelError(null);

    try {
      const diagnostic = await onProbeDriver({
        experimentalSidecar: runtimeRequest(),
      });
      setDriverDiagnostic(diagnostic);
    } catch (error) {
      setPanelError(errorToMessage(error, "Unable to probe JDBC driver."));
    } finally {
      setIsProbingDriver(false);
    }
  }

  async function handleCopyQuery() {
    if (!trimmedSql) {
      setQueryCopyMessage("Nothing to copy.");
      return;
    }

    const copied = await copyTextToClipboard(trimmedSql);
    setQueryCopyMessage(copied ? "SQL copied." : "Copy failed.");
  }

  return (
    <section aria-label="Read-only JDBC query workspace" className="jdbc-query-panel">
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
            {experimentalRuntime.enabled ? "Experimental sidecar" : "Mock execution"}
          </Badge>
          <Badge variant="success">Read-only</Badge>
        </div>
      </div>

      <div className="jdbc-safety-notice" aria-label="Read-only safety notice">
        <p>
          The mock validator accepts SELECT, WITH, SHOW, DESCRIBE, and mock
          EXPLAIN wrappers. Experimental real sidecar execution accepts only
          SELECT or WITH. Writes, DDL/DML, stored procedures, session mutation,
          and multi-statement batches are rejected. Nothing runs until you
          validate the visible SQL and press Run read-only query.
        </p>
      </div>

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
                void onSelectConnector(connectorId);
              }
            }}
            value={selectedConnectorId}
          >
            <option value="">Select connector</option>
            {connectors.map((connector) => (
              <option
                key={connector.connectorId}
                value={connector.connectorId}
              >
                {connector.displayName || "Untitled connector"}
              </option>
            ))}
          </select>
        </label>
        <label className="jdbc-field jdbc-query-limit-field" htmlFor={rowLimitInputId}>
          <span className="field-label">Row limit</span>
          <input
            className="input"
            id={rowLimitInputId}
            max={MAX_ROW_LIMIT}
            min={1}
            onChange={(event) => {
              const nextValue = Number(event.currentTarget.value);
              setRowLimit(nextValue);
              setExperimentalRuntime((current) => ({
                ...current,
                maxRows: nextValue,
              }));
              setPanelError(null);
            }}
            type="number"
            value={rowLimit}
          />
          <span className="jdbc-query-hint">Backend cap: 100 rows</span>
        </label>
        <label className="jdbc-field jdbc-query-limit-field" htmlFor={timeoutInputId}>
          <span className="field-label">Timeout ms</span>
          <input
            className="input"
            id={timeoutInputId}
            max={DEFAULT_TIMEOUT_MS}
            min={1}
            onChange={(event) => {
              const nextValue = Number(event.currentTarget.value);
              setTimeoutMs(nextValue);
              setExperimentalRuntime((current) => ({
                ...current,
                timeoutMs: nextValue,
              }));
              setPanelError(null);
            }}
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
            max={DEFAULT_MAX_RESULT_BYTES}
            min={1}
            onChange={(event) => {
              const nextValue = Number(event.currentTarget.value);
              setMaxResultBytes(nextValue);
              setExperimentalRuntime((current) => ({
                ...current,
                maxResultBytes: nextValue,
              }));
              setPanelError(null);
            }}
            type="number"
            value={maxResultBytes}
          />
          <span className="jdbc-query-hint">Backend cap: 256 KiB</span>
        </label>
      </div>

      <details className="jdbc-experimental-runtime">
        <summary>
          <span>Experimental sidecar runtime</span>
          <Badge variant="warning">Preview</Badge>
        </summary>
        <div className="jdbc-experimental-copy">
          <p>
            Opt-in only. Real JDBC requires an explicit sidecar classpath or
            JAR, explicit driver JAR, explicit JDBC URL, and explicit Run.
            Saved profiles store non-secret metadata only. Enter a password
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
              <p className="jdbc-pane-subtitle">
                Selecting a profile only fills the fields below. It does not
                connect, probe, or run SQL.
              </p>
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
                onChange={(event) =>
                  void handleSelectProfile(event.currentTarget.value)
                }
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
                onChange={(event) => {
                  setProfileName(event.currentTarget.value);
                  setProfileError(null);
                  setDeleteConfirmationArmed(false);
                }}
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
                onChange={(event) => {
                  setProfileDescription(event.currentTarget.value);
                  setProfileError(null);
                  setDeleteConfirmationArmed(false);
                }}
                value={profileDescription}
              />
            </label>
          </div>
          <div className="jdbc-profile-actions">
            <Button
              disabled={!selectedProfile || !selectedProfileDirty || isSavingProfile}
              onClick={() => void handleSaveProfile()}
              variant="primary"
            >
              {isSavingProfile && selectedProfile ? "Saving" : "Save profile"}
            </Button>
            <Button
              disabled={!profileApiAvailable || isSavingProfile}
              onClick={() => void handleSaveAsNewProfile()}
              variant="secondary"
            >
              Save as new profile
            </Button>
            <Button
              disabled={!selectedProfile || isDeletingProfile}
              onClick={() => void handleDeleteProfile()}
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
              setExperimentalRuntime((current) => ({
                ...current,
                enabled: event.currentTarget.checked,
              }))
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
                updateExperimentalRuntime("javaProgram", event.currentTarget.value)
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
                updateExperimentalRuntime(
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
                updateExperimentalRuntime(
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
                updateExperimentalRuntime(
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
                updateExperimentalRuntime(
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
                updateExperimentalRuntime(
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
                updateExperimentalRuntime("jdbcUrl", event.currentTarget.value)
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
                updateExperimentalRuntime("username", event.currentTarget.value)
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
                updateExperimentalRuntime(
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
              <p className="jdbc-pane-subtitle">
                Explicit checks only. HealthCheck and DriverProbe do not run SQL.
              </p>
            </div>
            <div className="jdbc-summary-badges">
              <Badge variant="neutral">Not automatic</Badge>
            </div>
          </div>
          <div className="jdbc-diagnostic-actions">
            <Button
              disabled={isCheckingHealth || isRunning}
              onClick={() => void handleCheckSidecar()}
              variant="secondary"
            >
              {isCheckingHealth ? "Checking" : "Check sidecar"}
            </Button>
            <Button
              disabled={isProbingDriver || isRunning}
              onClick={() => void handleProbeDriver()}
              variant="secondary"
            >
              {isProbingDriver ? "Probing" : "Probe driver"}
            </Button>
          </div>
          <div className="jdbc-diagnostic-status-grid">
            <JdbcDiagnosticStatus
              diagnostic={healthDiagnostic}
              label="Sidecar"
            />
            <JdbcDiagnosticStatus
              diagnostic={driverDiagnostic}
              label="Driver"
            />
          </div>
        </section>
      </details>

      <label className="jdbc-field jdbc-field-wide" htmlFor={sqlInputId}>
        <span className="field-label">SQL</span>
        <textarea
          className="input jdbc-sql-editor"
          id={sqlInputId}
          onChange={(event) => {
            setSql(event.currentTarget.value);
            setPanelError(null);
          }}
          placeholder="select 1"
          value={sql}
        />
      </label>

      <div className="jdbc-query-actions">
        <JdbcValidationStatus
          isValidationCurrent={isValidationCurrent}
          validation={validationSnapshot?.validation}
        />
        <div className="jdbc-sql-actions">
          <Button
            disabled={!trimmedSql}
            onClick={() => void handleCopyQuery()}
            variant="ghost"
          >
            Copy SQL
          </Button>
          <Button
            disabled={isValidating || isRunning}
            onClick={() => void handleValidate()}
            variant="secondary"
          >
            {isValidating ? "Validating" : "Validate SQL"}
          </Button>
          <Button
            disabled={Boolean(runBlockedReason) || isRunning}
            onClick={() => void handleRun()}
            title={runBlockedReason ?? undefined}
            variant="primary"
          >
            {isRunning ? "Running" : "Run read-only query"}
          </Button>
        </div>
      </div>

      {queryCopyMessage ? (
        <p className="jdbc-copy-feedback" role="status">
          {queryCopyMessage}
        </p>
      ) : null}

      {panelError ? (
        <p className="jdbc-message jdbc-message-error" role="alert">
          {panelError}
        </p>
      ) : null}

      {result ? (
        <JdbcReadOnlyQueryResultView
          maxResultBytes={resultCaps?.maxResultBytes ?? normalizedMaxResultBytes}
          result={result}
          timeoutMs={resultCaps?.timeoutMs ?? normalizedTimeoutMs}
        />
      ) : (
        <div className="jdbc-results-placeholder">
          <p className="jdbc-empty-title">Visible query results appear here.</p>
          <p className="jdbc-empty-text">
            Validate read-only SQL, then run it through the bounded mock
            adapter. No real database connection or credentials are used.
          </p>
        </div>
      )}
    </section>
  );

  function updateExperimentalRuntime(
    field: ExperimentalRuntimeTextField,
    value: string,
  ) {
    setExperimentalRuntime((current) => ({
      ...current,
      [field]: value,
    }));
    setPanelError(null);
    setProfileError(null);
    setDeleteConfirmationArmed(false);
  }

  function applyProfileToDraft(profile: JdbcConnectionProfile) {
    setProfileName(profile.name);
    setProfileDescription(profile.description);
    setRowLimit(profile.maxRows);
    setTimeoutMs(profile.timeoutMs);
    setMaxResultBytes(profile.maxResultBytes);
    setExperimentalRuntime((current) => ({
      ...current,
      credentialEnvVarName: profile.passwordEnvVarName ?? "",
      driverClassName: profile.driverClassName,
      driverJarPath: profile.driverJarPath,
      jdbcUrl: profile.jdbcUrl,
      maxResultBytes: profile.maxResultBytes,
      maxRows: profile.maxRows,
      timeoutMs: profile.timeoutMs,
      username: profile.username ?? "",
    }));
  }

  function profileRequest(): JdbcConnectionProfileCreateRequest {
    return {
      description: profileDescription,
      driverClassName: experimentalRuntime.driverClassName,
      driverJarPath: experimentalRuntime.driverJarPath,
      jdbcUrl: experimentalRuntime.jdbcUrl,
      maxResultBytes,
      maxRows: rowLimit,
      name: profileName,
      passwordEnvVarName: emptyToNull(
        experimentalRuntime.credentialEnvVarName,
      ),
      readOnly: true,
      timeoutMs,
      username: emptyToNull(experimentalRuntime.username),
    };
  }

  function runtimeRequest() {
    return {
      credentialEnvVarName: emptyToNull(
        experimentalRuntime.credentialEnvVarName,
      ),
      driverClassName: emptyToNull(experimentalRuntime.driverClassName),
      driverJarPath: experimentalRuntime.driverJarPath.trim(),
      enabled: true,
      javaProgram: emptyToNull(experimentalRuntime.javaProgram),
      jdbcUrl: experimentalRuntime.jdbcUrl.trim(),
      maxResultBytes: normalizedMaxResultBytes,
      maxRows: normalizedRowLimit,
      sidecarClasspath: emptyToNull(experimentalRuntime.sidecarClasspath),
      sidecarJarPath: emptyToNull(experimentalRuntime.sidecarJarPath),
      sidecarMainClass: emptyToNull(experimentalRuntime.sidecarMainClass),
      timeoutMs: normalizedTimeoutMs,
      username: emptyToNull(experimentalRuntime.username),
    };
  }
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
          : validation.rejectionReason ?? "SQL did not pass read-only validation."}
      </span>
    </div>
  );
}

function JdbcReadOnlyQueryResultView({
  maxResultBytes,
  result,
  timeoutMs,
}: {
  maxResultBytes: number;
  result: JdbcReadOnlyQueryResult;
  timeoutMs: number;
}) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const redactedError = result.sanitizedError
    ? redactJdbcText(result.sanitizedError)
    : null;
  const redactedRejection = result.validation.rejectionReason
    ? redactJdbcText(result.validation.rejectionReason)
    : null;

  async function handleCopyResults() {
    const copied = await copyTextToClipboard(resultToTsv(result));
    setCopyMessage(copied ? "Results copied as TSV." : "Copy failed.");
  }

  async function handleCopyError() {
    const copied = await copyTextToClipboard(errorDetailsText(result));
    setCopyMessage(copied ? "Error details copied." : "Copy failed.");
  }

  if (result.status !== "completed") {
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

  const columnCount = result.columns.length;
  const hasRows = result.rows.length > 0;

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
        <span>{columnCount.toString()} columns</span>
        <span>{result.durationMs.toString()} ms</span>
        <span>{result.truncated ? "Truncated: yes" : "Truncated: no"}</span>
      </div>
      <div className="jdbc-result-limits" aria-label="Result limits">
        <span>Max rows {result.rowLimit.toString()}</span>
        <span>Timeout {timeoutMs.toString()} ms</span>
        <span>Max result bytes {formatBytes(maxResultBytes)}</span>
      </div>
      {result.truncated ? <JdbcTruncationNotice result={result} /> : null}
      {!hasRows ? (
        <div className="jdbc-result-empty">
          <p className="jdbc-empty-title">No rows returned.</p>
          <p className="jdbc-empty-text">Query completed with a visible empty result.</p>
        </div>
      ) : (
        <div className="jdbc-result-table-wrap">
          <table className="jdbc-result-table">
            <thead>
              <tr>
                {result.columns.map((column) => (
                  <th key={column.name} scope="col">
                    <span>{column.name}</span>
                    <span>{column.valueKind}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {result.columns.map((column, columnIndex) => (
                    <td
                      className={`jdbc-result-cell jdbc-result-cell-${valueKindClass(column.valueKind)}`}
                      key={`${column.name}-${columnIndex.toString()}`}
                    >
                      <JdbcResultCell value={row[columnIndex] ?? null} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {copyMessage ? (
        <p className="jdbc-copy-feedback" role="status">
          {copyMessage}
        </p>
      ) : null}
    </div>
  );
}

function JdbcResultCell({ value }: { value: string | null }) {
  if (value === null) {
    return <span className="jdbc-result-null">NULL</span>;
  }

  const displayValue = redactJdbcText(value);

  return (
    <span className="jdbc-result-cell-value" title={displayValue}>
      {displayValue}
    </span>
  );
}

function resultSummaryText(result: JdbcReadOnlyQueryResult) {
  if (result.returnedRowCount === 0) {
    return "No rows returned query completed";
  }

  if (result.truncatedRows || result.returnedRowCount < result.rowCount) {
    return `${result.returnedRowCount.toString()} rows shown of ${result.rowCount.toString()} total`;
  }

  const rowLabel = result.returnedRowCount === 1 ? "row" : "rows";
  return `${result.returnedRowCount.toString()} ${rowLabel}`;
}

function resultToTsv(result: JdbcReadOnlyQueryResult) {
  const header = result.columns.map((column) => tsvCell(column.name)).join("\t");
  const rows = result.rows.map((row) =>
    result.columns
      .map((_column, columnIndex) =>
        tsvCell(displayCellValue(row[columnIndex] ?? null)),
      )
      .join("\t"),
  );

  return [header, ...rows].filter((line) => line.length > 0).join("\n");
}

function errorDetailsText(result: JdbcReadOnlyQueryResult) {
  return [
    `Status: ${result.status}`,
    result.sanitizedError
      ? `Error: ${redactJdbcErrorDetails(result.sanitizedError)}`
      : null,
    result.validation.rejectionReason
      ? `Validation: ${redactJdbcErrorDetails(result.validation.rejectionReason)}`
      : null,
    `Duration: ${result.durationMs.toString()} ms`,
    "No database write, hidden execution, or AI result sharing occurred.",
  ]
    .filter(Boolean)
    .join("\n");
}

function compactErrorSummary(value: string) {
  return redactJdbcText(
    value
      .split(/\r?\n/u)
      .find((line) => !/^\s*(at\s|stack\b|caused by:)/iu.test(line)) ??
      value,
  );
}

function redactJdbcErrorDetails(value: string) {
  return redactJdbcText(value)
    .split(/\r?\n/u)
    .filter((line) => !/^\s*(at\s|stack\b|caused by:)/iu.test(line))
    .join("\n");
}

function displayCellValue(value: string | null) {
  return value === null ? "NULL" : redactJdbcText(value);
}

function tsvCell(value: string) {
  return value.replace(/\r?\n/gu, " ").replace(/\t/gu, " ");
}

function valueKindClass(valueKind: string) {
  const normalized = valueKind.trim().toLowerCase();

  if (/^(bool|boolean)$/u.test(normalized)) {
    return "boolean";
  }

  if (/^(int|integer|bigint|smallint|decimal|double|float|numeric|number|real)$/u.test(normalized)) {
    return "number";
  }

  return "text";
}

function formatBytes(value: number) {
  if (value >= 1024 && value % 1024 === 0) {
    return `${(value / 1024).toString()} KiB`;
  }

  return `${value.toString()} bytes`;
}

function redactJdbcText(value: string) {
  return value
    .replace(
      /\b(password|passwd|pwd|token|access_token|secret|api_key|apikey|private_key|key)=([^;&\s]+)/giu,
      "$1=[redacted]",
    )
    .replace(
      /\b(password|passwd|pwd|token|access_token|secret|api_key|apikey|private_key|key):\s*([^\s,;]+)/giu,
      "$1: [redacted]",
    );
}

async function copyTextToClipboard(value: string) {
  if (!navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
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

function clampRowLimit(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_ROW_LIMIT;
  }

  return Math.min(MAX_ROW_LIMIT, Math.max(1, Math.trunc(value)));
}

function clampTimeoutMs(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_TIMEOUT_MS;
  }

  return Math.min(DEFAULT_TIMEOUT_MS, Math.max(1, Math.trunc(value)));
}

function clampMaxResultBytes(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_MAX_RESULT_BYTES;
  }

  return Math.min(DEFAULT_MAX_RESULT_BYTES, Math.max(1, Math.trunc(value)));
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function nullToEmpty(value: string | null) {
  return value ?? "";
}

function validateProfileRequest(
  request: JdbcConnectionProfileCreateRequest,
): string | null {
  if (!request.name.trim()) {
    return "Profile name is required.";
  }

  if (!request.driverJarPath.trim()) {
    return "Driver JAR path is required before saving a profile.";
  }

  if (!request.driverClassName.trim()) {
    return "Driver class is required before saving a profile.";
  }

  if (!request.jdbcUrl.trim()) {
    return "JDBC URL is required before saving a profile.";
  }

  if (containsSecretBearingJdbcUrlParam(request.jdbcUrl)) {
    return "JDBC URL must not contain password, token, secret, or key parameters.";
  }

  if (
    request.passwordEnvVarName &&
    !isEnvironmentVariableName(request.passwordEnvVarName)
  ) {
    return "Password env var name must be an environment variable name, not a value.";
  }

  if (!Number.isInteger(request.maxRows) || request.maxRows < 1 || request.maxRows > MAX_ROW_LIMIT) {
    return "Max rows must be between 1 and 100.";
  }

  if (
    !Number.isInteger(request.timeoutMs) ||
    request.timeoutMs < 1 ||
    request.timeoutMs > DEFAULT_TIMEOUT_MS
  ) {
    return "Timeout ms must be between 1 and 10000.";
  }

  if (
    !Number.isInteger(request.maxResultBytes) ||
    request.maxResultBytes < 1 ||
    request.maxResultBytes > DEFAULT_MAX_RESULT_BYTES
  ) {
    return "Max result bytes must be between 1 and 262144.";
  }

  return null;
}

function containsSecretBearingJdbcUrlParam(value: string) {
  const secretKeys = new Set([
    "password",
    "passwd",
    "pwd",
    "token",
    "access_token",
    "secret",
    "key",
    "api_key",
    "apikey",
    "private_key",
  ]);

  return value.split(/[?&;]/u).some((segment) => {
    const [key, secretValue = ""] = segment.split("=", 2);
    return secretKeys.has(key.trim().toLowerCase()) && secretValue.trim() !== "";
  });
}

function isEnvironmentVariableName(value: string) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/u.test(value.trim());
}

function describeRunBlocker({
  currentValidation,
  hasExecuteApi,
  isValidationCurrent,
  selectedConnector,
  trimmedSql,
}: {
  currentValidation: JdbcReadOnlySqlValidation | null | undefined;
  hasExecuteApi: boolean;
  isValidationCurrent: boolean;
  selectedConnector: JdbcConnector | null;
  trimmedSql: string;
}) {
  if (!hasExecuteApi) {
    return "JDBC read-only query execution is unavailable in this runtime.";
  }

  if (!selectedConnector) {
    return "Select a connector before running SQL.";
  }

  if (!trimmedSql) {
    return "Enter SQL before running.";
  }

  if (!isValidationCurrent || !currentValidation) {
    return "Validate the current SQL before running.";
  }

  if (!currentValidation.isValid) {
    return currentValidation.rejectionReason ?? "SQL was rejected.";
  }

  return null;
}
