import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  JdbcQueryEditorPanel,
  type ExperimentalRuntimeTextField,
} from "./JdbcQueryEditorPanel";
import { JdbcReadOnlyQueryResultView } from "./JdbcQueryResultSummary";
import {
  copyTextToClipboard,
  describeRunBlocker,
} from "./jdbcQueryResultFormatters";

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
      <JdbcQueryEditorPanel
        connectionProfiles={connectionProfiles}
        connectors={connectors}
        deleteConfirmationArmed={deleteConfirmationArmed}
        driverDiagnostic={driverDiagnostic}
        experimentalRuntime={experimentalRuntime}
        healthDiagnostic={healthDiagnostic}
        isCheckingHealth={isCheckingHealth}
        isConnectorSelectionDisabled={isConnectorSelectionDisabled}
        isDeletingProfile={isDeletingProfile}
        isLoadingProfiles={isLoadingProfiles}
        isProbingDriver={isProbingDriver}
        isRunning={isRunning}
        isSavingProfile={isSavingProfile}
        isValidating={isValidating}
        isValidationCurrent={isValidationCurrent}
        maxResultBytes={maxResultBytes}
        maxResultBytesCap={DEFAULT_MAX_RESULT_BYTES}
        maxRowLimit={MAX_ROW_LIMIT}
        onCheckSidecar={() => void handleCheckSidecar()}
        onCopyQuery={() => void handleCopyQuery()}
        onDeleteProfile={() => void handleDeleteProfile()}
        onExperimentalEnabledChange={(enabled) =>
          setExperimentalRuntime((current) => ({
            ...current,
            enabled,
          }))
        }
        onMaxResultBytesChange={(nextValue) => {
          setMaxResultBytes(nextValue);
          setExperimentalRuntime((current) => ({
            ...current,
            maxResultBytes: nextValue,
          }));
          setPanelError(null);
        }}
        onProbeDriver={() => void handleProbeDriver()}
        onProfileDescriptionChange={(value) => {
          setProfileDescription(value);
          setProfileError(null);
          setDeleteConfirmationArmed(false);
        }}
        onProfileNameChange={(value) => {
          setProfileName(value);
          setProfileError(null);
          setDeleteConfirmationArmed(false);
        }}
        onRowLimitChange={(nextValue) => {
          setRowLimit(nextValue);
          setExperimentalRuntime((current) => ({
            ...current,
            maxRows: nextValue,
          }));
          setPanelError(null);
        }}
        onRun={() => void handleRun()}
        onRuntimeFieldChange={updateExperimentalRuntime}
        onSaveAsNewProfile={() => void handleSaveAsNewProfile()}
        onSaveProfile={() => void handleSaveProfile()}
        onSelectConnector={(connectorId) => void onSelectConnector(connectorId)}
        onSelectProfile={(profileId) => void handleSelectProfile(profileId)}
        onSqlChange={(value) => {
          setSql(value);
          setPanelError(null);
        }}
        onTimeoutMsChange={(nextValue) => {
          setTimeoutMs(nextValue);
          setExperimentalRuntime((current) => ({
            ...current,
            timeoutMs: nextValue,
          }));
          setPanelError(null);
        }}
        onValidate={() => void handleValidate()}
        profileApiAvailable={profileApiAvailable}
        profileDescription={profileDescription}
        profileError={profileError}
        profileMessage={profileMessage}
        profileName={profileName}
        queryCopyMessage={queryCopyMessage}
        rowLimit={rowLimit}
        runBlockedReason={runBlockedReason}
        selectedConnectorId={selectedConnectorId}
        selectedProfile={selectedProfile}
        selectedProfileDirty={selectedProfileDirty}
        sql={sql}
        timeoutCapMs={DEFAULT_TIMEOUT_MS}
        timeoutMs={timeoutMs}
        trimmedSql={trimmedSql}
        validation={validationSnapshot?.validation}
      />

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
