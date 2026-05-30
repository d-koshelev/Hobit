import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import type {
  JdbcConnector,
  JdbcConnectorStatus,
  JdbcDatabaseKind,
  JdbcDriverKind,
} from "../workspace/jdbcConnectorTypes";
import { JdbcReadOnlyQueryPanel } from "./JdbcReadOnlyQueryPanel";
import {
  JdbcConnectorStatusChip,
  jdbcConnectorFrameStatus,
} from "./JdbcConnectorWidgetStatus";
import {
  DATABASE_KIND_OPTIONS,
  DRIVER_KIND_OPTIONS,
  JDBC_BOUNDARY_FINDER_SAMPLE_PRESETS,
  STATUS_OPTIONS,
  databaseKindLabel,
  errorToMessage,
  formatUpdatedTimestamp,
  renderJdbcBoundarySql,
  validateJdbcBoundaryPreset,
  type JdbcBoundaryFilterDefinition,
  type JdbcBoundaryFilterValues,
  type JdbcBoundaryPreset,
} from "./jdbcConnectorWidgetModel";
import type { WidgetRenderProps } from "./types";

export function JdbcConnectorWidget({
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  logRefreshToken,
  onCheckJdbcSidecarHealth,
  onCreateJdbcConnectionProfile,
  onCreateJdbcConnector,
  onDeleteJdbcConnectionProfile,
  onExecuteJdbcReadOnlyQuery,
  onGetJdbcConnector,
  onListJdbcConnectors,
  onListJdbcConnectionProfiles,
  onLoadLogs,
  onProbeJdbcDriver,
  onStartFrameMove,
  onUpdateJdbcConnectionProfile,
  onUpdateJdbcConnector,
  onValidateJdbcReadOnlySql,
  title,
}: WidgetRenderProps) {
  const displayNameInputId = useId();
  const databaseKindInputId = useId();
  const driverKindInputId = useId();
  const jdbcUrlInputId = useId();
  const environmentInputId = useId();
  const statusInputId = useId();
  const notesInputId = useId();
  const readOnlyInputId = useId();
  const apiAvailable = Boolean(
    onCreateJdbcConnector &&
      onGetJdbcConnector &&
      onListJdbcConnectors &&
      onUpdateJdbcConnector,
  );
  const [connectors, setConnectors] = useState<JdbcConnector[]>([]);
  const [selectedConnector, setSelectedConnector] =
    useState<JdbcConnector | null>(null);
  const [draftDisplayName, setDraftDisplayName] = useState("");
  const [draftDatabaseKind, setDraftDatabaseKind] =
    useState<JdbcDatabaseKind>("generic_jdbc");
  const [draftDriverKind, setDraftDriverKind] =
    useState<JdbcDriverKind>("jdbc");
  const [draftJdbcUrlMasked, setDraftJdbcUrlMasked] = useState("jdbc:");
  const [draftEnvironment, setDraftEnvironment] = useState("local");
  const [draftReadOnlyDefault, setDraftReadOnlyDefault] = useState(true);
  const [draftStatus, setDraftStatus] =
    useState<JdbcConnectorStatus>("not_configured");
  const [draftNotes, setDraftNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const [saveStateText, setSaveStateText] = useState("Saved");

  const isDirty = Boolean(
    selectedConnector &&
      (draftDisplayName !== selectedConnector.displayName ||
        draftDatabaseKind !== selectedConnector.databaseKind ||
        draftDriverKind !== selectedConnector.driverKind ||
        draftJdbcUrlMasked !== selectedConnector.jdbcUrlMasked ||
        draftEnvironment !== selectedConnector.environment ||
        draftReadOnlyDefault !== selectedConnector.readOnlyDefault ||
        draftStatus !== selectedConnector.status ||
        draftNotes !== selectedConnector.notes),
  );

  const selectedUpdatedText = selectedConnector
    ? formatUpdatedTimestamp(selectedConnector.updatedAt)
    : null;

  const connectorCountText = useMemo(() => {
    if (connectors.length === 1) {
      return "1 connector";
    }

    return `${connectors.length.toString()} connectors`;
  }, [connectors.length]);

  const loadConnectors = useCallback(
    async (preferredConnectorId?: string | null) => {
      if (
        !onListJdbcConnectors ||
        !onGetJdbcConnector ||
        !onCreateJdbcConnector ||
        !onUpdateJdbcConnector
      ) {
        setConnectors([]);
        clearSelectedConnector();
        setLoadError(
          "JDBC connector metadata persistence is unavailable in this runtime.",
        );
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);
      setEditorError(null);
      setValidationMessage(null);

      try {
        const loadedConnectors = await onListJdbcConnectors();
        setConnectors(loadedConnectors);

        const preferredExists = loadedConnectors.some(
          (connector) => connector.connectorId === preferredConnectorId,
        );
        const connectorIdToSelect = preferredExists
          ? preferredConnectorId
          : loadedConnectors[0]?.connectorId;

        if (!connectorIdToSelect) {
          clearSelectedConnector();
          return;
        }

        const detail = await onGetJdbcConnector(connectorIdToSelect);

        if (!detail) {
          clearSelectedConnector();
          setEditorError("The selected JDBC connector could not be found.");
          return;
        }

        setSelectedDraft(detail);
        setSaveStateText("Saved");
      } catch (error) {
        setConnectors([]);
        clearSelectedConnector();
        setLoadError(
          errorToMessage(error, "Unable to load JDBC connectors."),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      onCreateJdbcConnector,
      onGetJdbcConnector,
      onListJdbcConnectors,
      onUpdateJdbcConnector,
    ],
  );

  useEffect(() => {
    void loadConnectors(null);
  }, [loadConnectors]);

  async function createConnector() {
    if (!onCreateJdbcConnector || isCreating || isLoading) {
      return;
    }

    if (isDirty) {
      setValidationMessage(
        "Save current connector metadata before creating another connector.",
      );
      return;
    }

    setIsCreating(true);
    setLoadError(null);
    setEditorError(null);
    setValidationMessage(null);

    try {
      const createdConnector = await onCreateJdbcConnector({
        databaseKind: "generic_jdbc",
        displayName: "New connector",
        driverKind: "jdbc",
        environment: "local",
        jdbcUrlMasked: "jdbc:",
        notes: "",
        readOnlyDefault: true,
        status: "not_configured",
      });
      await loadConnectors(createdConnector.connectorId);
    } catch (error) {
      setEditorError(
        errorToMessage(error, "Unable to create JDBC connector."),
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function selectConnector(connectorId: string) {
    if (
      !onGetJdbcConnector ||
      isSelecting ||
      selectedConnector?.connectorId === connectorId
    ) {
      return;
    }

    if (isDirty) {
      setValidationMessage(
        "Save current connector metadata before selecting another connector.",
      );
      return;
    }

    setIsSelecting(true);
    setEditorError(null);
    setValidationMessage(null);

    try {
      const detail = await onGetJdbcConnector(connectorId);

      if (!detail) {
        setEditorError("The selected JDBC connector could not be found.");
        return;
      }

      setSelectedDraft(detail);
      setConnectors((currentConnectors) =>
        currentConnectors.map((connector) =>
          connector.connectorId === detail.connectorId ? detail : connector,
        ),
      );
      setSaveStateText("Saved");
    } catch (error) {
      setEditorError(errorToMessage(error, "Unable to open JDBC connector."));
    } finally {
      setIsSelecting(false);
    }
  }

  async function refreshConnectors() {
    if (isDirty) {
      setValidationMessage(
        "Save current connector metadata before refreshing connectors.",
      );
      return;
    }

    await loadConnectors(selectedConnector?.connectorId ?? null);
  }

  async function saveConnector() {
    if (
      !selectedConnector ||
      !onUpdateJdbcConnector ||
      !isDirty ||
      isSaving
    ) {
      return;
    }

    const nextDisplayName = draftDisplayName.trim();

    if (!nextDisplayName) {
      setValidationMessage("Display name is required before saving.");
      return;
    }

    setIsSaving(true);
    setEditorError(null);
    setValidationMessage(null);
    setSaveStateText("Saving");

    try {
      const updatedConnector = await onUpdateJdbcConnector({
        connectorId: selectedConnector.connectorId,
        databaseKind: draftDatabaseKind,
        displayName: nextDisplayName,
        driverKind: draftDriverKind,
        environment: draftEnvironment.trim(),
        jdbcUrlMasked: draftJdbcUrlMasked.trim(),
        notes: draftNotes,
        readOnlyDefault: draftReadOnlyDefault,
        status: draftStatus,
      });

      if (!updatedConnector) {
        setEditorError("The selected JDBC connector could not be found.");
        setSaveStateText("Unsaved changes");
        return;
      }

      setSelectedDraft(updatedConnector);
      setConnectors((currentConnectors) =>
        currentConnectors.map((connector) =>
          connector.connectorId === updatedConnector.connectorId
            ? updatedConnector
            : connector,
        ),
      );
      setSaveStateText("Saved");
    } catch (error) {
      setEditorError(errorToMessage(error, "Unable to save JDBC connector."));
      setSaveStateText("Unsaved changes");
    } finally {
      setIsSaving(false);
    }
  }

  function setSelectedDraft(connector: JdbcConnector) {
    setSelectedConnector(connector);
    setDraftDisplayName(connector.displayName);
    setDraftDatabaseKind(connector.databaseKind);
    setDraftDriverKind(connector.driverKind);
    setDraftJdbcUrlMasked(connector.jdbcUrlMasked);
    setDraftEnvironment(connector.environment);
    setDraftReadOnlyDefault(connector.readOnlyDefault);
    setDraftStatus(connector.status);
    setDraftNotes(connector.notes);
  }

  function clearSelectedConnector() {
    setSelectedConnector(null);
    setDraftDisplayName("");
    setDraftDatabaseKind("generic_jdbc");
    setDraftDriverKind("jdbc");
    setDraftJdbcUrlMasked("jdbc:");
    setDraftEnvironment("local");
    setDraftReadOnlyDefault(true);
    setDraftStatus("not_configured");
    setDraftNotes("");
    setSaveStateText("Saved");
  }

  function clearValidation() {
    setValidationMessage(null);
  }

  const jdbcFrameActions = (
    <>
      <Button
        disabled={isLoading || isSaving || !apiAvailable}
        onClick={refreshConnectors}
        variant="ghost"
      >
        Refresh
      </Button>
      <Button
        disabled={isCreating || isLoading || !apiAvailable}
        onClick={createConnector}
        variant="primary"
      >
        {isCreating ? "Creating" : "New connector"}
      </Button>
      {frameActions}
    </>
  );

  return (
    <WidgetFrame
      actions={jdbcFrameActions}
      logRefreshToken={logRefreshToken}
      moveEnabled={frameMoveEnabled}
      onLoadLogs={onLoadLogs ? () => onLoadLogs(instance.id) : undefined}
      onMoveStart={onStartFrameMove}
      status={jdbcConnectorFrameStatus({
        apiAvailable,
        isDirty,
        isLoading,
        isSaving,
        loadError,
        selectedConnector,
      })}
      style={frameStyle}
      title={title}
    >
      <div className="jdbc-widget-shell">
        <section className="jdbc-summary">
          <div className="jdbc-summary-copy">
            <p className="jdbc-eyebrow">Database / JDBC Preview</p>
            <p className="jdbc-summary-text">
              Create an explicit workspace-local connection profile, review
              the visible SQL, and run only bounded read-only mock queries from
              this widget. Real database connections, credentials, and AI result
              sharing are not enabled.
            </p>
          </div>
          <div className="jdbc-summary-badges">
            <Badge variant="neutral">Preview</Badge>
            <Badge variant="info">Mock read-only</Badge>
            <Badge variant="warning">No secrets</Badge>
          </div>
        </section>

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
              <span className="jdbc-runtime-value">
                Explicit operator run only
              </span>
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
              The desktop path validates ownership of this Database / JDBC
              widget, validates conservative read-only SQL, and then uses the
              mock adapter by default. Sidecar or real connector runtime remains
              unsupported/not configured for product use in this slice; visible
              runtime errors such as not_configured or unsupported_driver are
              shown in the result area.
            </p>
          </details>
        </section>

        <div className="jdbc-layout">
          <aside className="jdbc-list-pane" aria-label="JDBC connectors">
            <div className="jdbc-pane-header">
              <div>
                <p className="jdbc-pane-title">Connection profiles</p>
                <p className="jdbc-pane-subtitle">{connectorCountText}</p>
              </div>
            </div>
            <div className="jdbc-connector-list" role="list">
              {isLoading ? (
                <p className="jdbc-empty-text">Loading JDBC connectors.</p>
              ) : loadError ? (
                <p className="jdbc-message jdbc-message-error" role="alert">
                  {loadError}
                </p>
              ) : connectors.length === 0 ? (
                <div className="jdbc-empty-state">
                  <p className="jdbc-empty-title">No connection profiles yet.</p>
                  <p className="jdbc-empty-text">
                    Create a non-secret metadata profile before validating or
                    running a read-only mock query.
                  </p>
                  <Button
                    disabled={isCreating || !apiAvailable}
                    onClick={createConnector}
                    variant="primary"
                  >
                    New connector
                  </Button>
                </div>
              ) : (
                connectors.map((connector) => (
                  <button
                    aria-current={
                      selectedConnector?.connectorId === connector.connectorId
                        ? "true"
                        : undefined
                    }
                    className={
                      selectedConnector?.connectorId === connector.connectorId
                        ? "jdbc-connector-row jdbc-connector-row-selected"
                        : "jdbc-connector-row"
                    }
                    disabled={isSelecting}
                    key={connector.connectorId}
                    onClick={() => void selectConnector(connector.connectorId)}
                    type="button"
                  >
                    <span className="jdbc-row-title-line">
                      <span className="jdbc-row-title">
                        {connector.displayName || "Untitled connector"}
                      </span>
                      <JdbcConnectorStatusChip status={connector.status} />
                    </span>
                    <span className="jdbc-row-meta">
                      {databaseKindLabel(connector.databaseKind)}
                      <span aria-hidden="true">/</span>
                      {connector.environment || "No environment"}
                    </span>
                    <span className="jdbc-row-meta">
                      {connector.readOnlyDefault
                        ? "Read-only profile"
                        : "Read-only profile flag off"}
                      <span aria-hidden="true">/</span>
                      {formatUpdatedTimestamp(connector.updatedAt)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="jdbc-editor-pane" aria-label="Selected connector">
            {isLoading ? (
              <div className="jdbc-empty-state">
                <p className="jdbc-empty-title">Loading connector metadata.</p>
                <p className="jdbc-empty-text">
                  Workspace-local JDBC connector records are loading.
                </p>
              </div>
            ) : loadError ? (
              <div className="jdbc-empty-state" role="alert">
                <p className="jdbc-empty-title">Connector metadata unavailable.</p>
                <p className="jdbc-empty-text">{loadError}</p>
              </div>
            ) : selectedConnector ? (
              <div className="jdbc-editor">
                <div className="jdbc-editor-meta">
                  <span>{selectedUpdatedText}</span>
                  <span>{isDirty ? "Unsaved changes" : saveStateText}</span>
                </div>

                <div className="jdbc-editor-grid">
                  <label className="jdbc-field jdbc-field-wide">
                    <span className="field-label">Display name</span>
                    <input
                      className="input"
                      id={displayNameInputId}
                      onChange={(event) => {
                        setDraftDisplayName(event.currentTarget.value);
                        clearValidation();
                      }}
                      value={draftDisplayName}
                    />
                  </label>
                  <label className="jdbc-field">
                    <span className="field-label">Database kind</span>
                    <select
                      className="select"
                      id={databaseKindInputId}
                      onChange={(event) => {
                        setDraftDatabaseKind(
                          event.currentTarget.value as JdbcDatabaseKind,
                        );
                        clearValidation();
                      }}
                      value={draftDatabaseKind}
                    >
                      {DATABASE_KIND_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="jdbc-field">
                    <span className="field-label">Driver kind</span>
                    <select
                      className="select"
                      id={driverKindInputId}
                      onChange={(event) => {
                        setDraftDriverKind(
                          event.currentTarget.value as JdbcDriverKind,
                        );
                        clearValidation();
                      }}
                      value={draftDriverKind}
                    >
                      {DRIVER_KIND_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="jdbc-field jdbc-field-wide">
                    <span className="field-label">Masked JDBC URL metadata</span>
                    <input
                      className="input"
                      id={jdbcUrlInputId}
                      onChange={(event) => {
                        setDraftJdbcUrlMasked(event.currentTarget.value);
                        clearValidation();
                      }}
                      placeholder="jdbc:"
                      value={draftJdbcUrlMasked}
                    />
                  </label>
                  <label className="jdbc-field">
                    <span className="field-label">Environment</span>
                    <input
                      className="input"
                      id={environmentInputId}
                      onChange={(event) => {
                        setDraftEnvironment(event.currentTarget.value);
                        clearValidation();
                      }}
                      placeholder="local"
                      value={draftEnvironment}
                    />
                  </label>
                  <label className="jdbc-field">
                    <span className="field-label">Status</span>
                    <select
                      className="select"
                      id={statusInputId}
                      onChange={(event) => {
                        setDraftStatus(
                          event.currentTarget.value as JdbcConnectorStatus,
                        );
                        clearValidation();
                      }}
                      value={draftStatus}
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label
                    className="jdbc-readonly-toggle"
                    htmlFor={readOnlyInputId}
                  >
                    <input
                      checked={draftReadOnlyDefault}
                      id={readOnlyInputId}
                      onChange={(event) => {
                        setDraftReadOnlyDefault(event.currentTarget.checked);
                        clearValidation();
                      }}
                      type="checkbox"
                    />
                    Read-only default
                  </label>
                  <label className="jdbc-field jdbc-field-wide">
                    <span className="field-label">Notes</span>
                    <textarea
                      className="input jdbc-notes-input"
                      id={notesInputId}
                      onChange={(event) => {
                        setDraftNotes(event.currentTarget.value);
                        clearValidation();
                      }}
                      value={draftNotes}
                    />
                  </label>
                </div>

                <p className="jdbc-secret-note">
                  Do not enter passwords or tokens here. Connector secrets are
                  not supported in this slice.
                </p>

                <div className="jdbc-editor-actions">
                  <Button
                    disabled={!selectedConnector || !isDirty || isSaving}
                    onClick={saveConnector}
                    variant="primary"
                  >
                    {isSaving ? "Saving" : "Save metadata"}
                  </Button>
                </div>

                {validationMessage ? (
                  <p className="jdbc-message jdbc-message-warning" role="alert">
                    {validationMessage}
                  </p>
                ) : null}
                {editorError ? (
                  <p className="jdbc-message jdbc-message-error" role="alert">
                    {editorError}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="jdbc-empty-state">
                <p className="jdbc-empty-title">No connector selected.</p>
                <p className="jdbc-empty-text">
                  Select a connection profile or create a new non-secret
                  metadata record.
                </p>
                <Button
                  disabled={isCreating || !apiAvailable}
                  onClick={createConnector}
                  variant="primary"
                >
                  New connector
                </Button>
              </div>
            )}
          </section>
        </div>

        <JdbcReadOnlyQueryPanel
          connectors={connectors}
          isConnectorSelectionDisabled={isSelecting || isDirty}
          onCreateConnectionProfile={onCreateJdbcConnectionProfile}
          onDeleteConnectionProfile={onDeleteJdbcConnectionProfile}
          onCheckSidecarHealth={
            onCheckJdbcSidecarHealth
              ? (request) => onCheckJdbcSidecarHealth(instance.id, request)
              : undefined
          }
          onExecuteQuery={
            onExecuteJdbcReadOnlyQuery
              ? (request) => onExecuteJdbcReadOnlyQuery(instance.id, request)
              : undefined
          }
          onProbeDriver={
            onProbeJdbcDriver
              ? (request) => onProbeJdbcDriver(instance.id, request)
              : undefined
          }
          onListConnectionProfiles={onListJdbcConnectionProfiles}
          onSelectConnector={selectConnector}
          onUpdateConnectionProfile={onUpdateJdbcConnectionProfile}
          onValidateSql={
            onValidateJdbcReadOnlySql
              ? (request) => onValidateJdbcReadOnlySql(instance.id, request)
              : undefined
          }
          selectedConnector={selectedConnector}
        />

        <JdbcBoundaryFinderPanel />
      </div>
    </WidgetFrame>
  );
}

type JdbcBoundaryFinderPanelProps = {
  presets?: JdbcBoundaryPreset[];
};

export function JdbcBoundaryFinderPanel({
  presets = JDBC_BOUNDARY_FINDER_SAMPLE_PRESETS,
}: JdbcBoundaryFinderPanelProps) {
  const presetInputId = useId();
  const rangeMinInputId = useId();
  const rangeMaxInputId = useId();
  const precisionInputId = useId();
  const probeValueInputId = useId();
  const [selectedPresetId, setSelectedPresetId] = useState(
    presets[0]?.presetId ?? "",
  );
  const selectedPreset = useMemo(
    () =>
      presets.find((preset) => preset.presetId === selectedPresetId) ??
      presets[0] ??
      null,
    [presets, selectedPresetId],
  );
  const [filterDrafts, setFilterDrafts] = useState<Record<string, string>>(() =>
    selectedPreset ? defaultBoundaryFilterDrafts(selectedPreset) : {},
  );
  const [rangeMin, setRangeMin] = useState(() =>
    selectedPreset?.range.min.toString() ?? "0",
  );
  const [rangeMax, setRangeMax] = useState(() =>
    selectedPreset?.range.max.toString() ?? "100",
  );
  const [precision, setPrecision] = useState(() =>
    selectedPreset?.range.precision.toString() ?? "1",
  );
  const [probeValue, setProbeValue] = useState(() =>
    selectedPreset
      ? String((selectedPreset.range.min + selectedPreset.range.max) / 2)
      : "50",
  );

  useEffect(() => {
    if (!selectedPreset) {
      return;
    }

    setFilterDrafts(defaultBoundaryFilterDrafts(selectedPreset));
    setRangeMin(selectedPreset.range.min.toString());
    setRangeMax(selectedPreset.range.max.toString());
    setPrecision(selectedPreset.range.precision.toString());
    setProbeValue(
      String((selectedPreset.range.min + selectedPreset.range.max) / 2),
    );
  }, [selectedPreset]);

  if (!selectedPreset) {
    return (
      <section aria-label="Boundary Finder" className="jdbc-boundary-panel">
        <div className="jdbc-sql-header">
          <div>
            <p className="jdbc-pane-title">Boundary Finder</p>
            <p className="jdbc-pane-subtitle">
              No Boundary Finder presets are available in this frontend build.
            </p>
          </div>
          <Badge variant="warning">Preview only</Badge>
        </div>
      </section>
    );
  }

  const preview = boundaryPreview({
    filterDrafts,
    precision,
    probeValue,
    rangeMax,
    rangeMin,
    selectedPreset,
  });
  const validationErrors = [
    ...preview.presetValidation.errors,
    ...(preview.previewError ? [preview.previewError] : []),
  ];

  function updateFilterValue(key: string, value: string) {
    setFilterDrafts((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <section aria-label="Boundary Finder" className="jdbc-boundary-panel">
      <div className="jdbc-sql-header">
        <div>
          <p className="jdbc-pane-title">Boundary Finder</p>
          <p className="jdbc-pane-subtitle">
            Preset-driven SQL preview for typed filters and a sample probe
            value. Boundary execution is not wired in this block.
          </p>
        </div>
        <div className="jdbc-summary-badges">
          <Badge variant="info">Preset UI</Badge>
          <Badge variant="warning">Preview only</Badge>
        </div>
      </div>

      <div className="jdbc-boundary-grid">
        <label className="jdbc-field jdbc-field-wide" htmlFor={presetInputId}>
          <span className="field-label">Boundary Finder preset</span>
          <select
            className="select"
            id={presetInputId}
            onChange={(event) => setSelectedPresetId(event.currentTarget.value)}
            value={selectedPreset.presetId}
          >
            {presets.map((preset) => (
              <option key={preset.presetId} value={preset.presetId}>
                {preset.name}
              </option>
            ))}
          </select>
        </label>

        <div className="jdbc-boundary-description jdbc-field-wide">
          <span className="jdbc-runtime-label">Preset description</span>
          <span className="jdbc-runtime-value">
            {selectedPreset.description ??
              "Preview-only Boundary Finder preset."}
          </span>
        </div>

        {selectedPreset.filters.map((filter) => (
          <JdbcBoundaryFilterInput
            filter={filter}
            key={filter.key}
            onChange={(value) => updateFilterValue(filter.key, value)}
            value={filterDrafts[filter.key] ?? ""}
          />
        ))}

        <label className="jdbc-field" htmlFor={rangeMinInputId}>
          <span className="field-label">Range min</span>
          <input
            className="input"
            id={rangeMinInputId}
            onChange={(event) => setRangeMin(event.currentTarget.value)}
            type="number"
            value={rangeMin}
          />
        </label>
        <label className="jdbc-field" htmlFor={rangeMaxInputId}>
          <span className="field-label">Range max</span>
          <input
            className="input"
            id={rangeMaxInputId}
            onChange={(event) => setRangeMax(event.currentTarget.value)}
            type="number"
            value={rangeMax}
          />
        </label>
        <label className="jdbc-field" htmlFor={precisionInputId}>
          <span className="field-label">Precision</span>
          <input
            className="input"
            id={precisionInputId}
            min="0"
            onChange={(event) => setPrecision(event.currentTarget.value)}
            type="number"
            value={precision}
          />
        </label>
        <label className="jdbc-field" htmlFor={probeValueInputId}>
          <span className="field-label">Sample probe value</span>
          <input
            className="input"
            id={probeValueInputId}
            onChange={(event) => setProbeValue(event.currentTarget.value)}
            type="number"
            value={probeValue}
          />
        </label>
      </div>

      {validationErrors.length > 0 ? (
        <div
          aria-label="Boundary Finder validation errors"
          className="jdbc-message jdbc-message-error"
          role="alert"
        >
          {validationErrors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : (
        <p className="jdbc-message jdbc-message-warning">
          SQL preview only. No Boundary Finder probes, JDBC queries, sidecar
          calls, Queue tasks, Agent Executor runs, or Workspace Agent actions
          are started from this section.
        </p>
      )}

      <div className="jdbc-boundary-preview">
        <div className="jdbc-result-toolbar">
          <div>
            <p className="jdbc-empty-title">Rendered SQL preview</p>
            <p className="jdbc-empty-text">
              Values are rendered as typed literals through the safe Boundary
              Finder template renderer.
            </p>
          </div>
          <Button
            disabled
            title="Boundary Finder execution is planned and not wired in this block."
            variant="secondary"
          >
            Run boundary search
          </Button>
        </div>
        <pre aria-label="Boundary Finder SQL preview">
          {preview.sql ?? "Fix validation errors to render the SQL preview."}
        </pre>
      </div>
    </section>
  );
}

function JdbcBoundaryFilterInput({
  filter,
  onChange,
  value,
}: {
  filter: JdbcBoundaryFilterDefinition;
  onChange: (value: string) => void;
  value: string;
}) {
  const inputId = useId();
  const label = `${filter.label}${filter.required ? " required" : ""}`;

  if (filter.type === "boolean") {
    return (
      <label className="jdbc-field" htmlFor={inputId}>
        <span className="field-label">{label}</span>
        <select
          className="select"
          id={inputId}
          onChange={(event) => onChange(event.currentTarget.value)}
          value={value}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
        <span className="jdbc-query-hint">{boundaryFilterHint(filter)}</span>
      </label>
    );
  }

  return (
    <label className="jdbc-field" htmlFor={inputId}>
      <span className="field-label">{label}</span>
      <input
        className="input"
        id={inputId}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={boundaryFilterPlaceholder(filter)}
        type={boundaryFilterInputType(filter)}
        value={value}
      />
      <span className="jdbc-query-hint">{boundaryFilterHint(filter)}</span>
    </label>
  );
}

function boundaryPreview({
  filterDrafts,
  precision,
  probeValue,
  rangeMax,
  rangeMin,
  selectedPreset,
}: {
  filterDrafts: Record<string, string>;
  precision: string;
  probeValue: string;
  rangeMax: string;
  rangeMin: string;
  selectedPreset: JdbcBoundaryPreset;
}) {
  const presetWithRange: JdbcBoundaryPreset = {
    ...selectedPreset,
    range: {
      ...selectedPreset.range,
      max: parseBoundaryNumber(rangeMax),
      min: parseBoundaryNumber(rangeMin),
      precision: parseBoundaryNumber(precision),
    },
  };
  const presetValidation = validateJdbcBoundaryPreset(presetWithRange);
  const parsedProbeValue = parseBoundaryNumber(probeValue);

  if (!Number.isFinite(parsedProbeValue)) {
    return {
      presetValidation,
      previewError: "Boundary probe value must be a finite number.",
      sql: null,
    };
  }

  if (!presetValidation.isValid) {
    return {
      presetValidation,
      previewError: null,
      sql: null,
    };
  }

  try {
    return {
      presetValidation,
      previewError: null,
      sql: renderJdbcBoundarySql(
        presetWithRange,
        parseBoundaryFilterDrafts(selectedPreset.filters, filterDrafts),
        parsedProbeValue,
      ),
    };
  } catch (error) {
    return {
      presetValidation,
      previewError: errorToMessage(
        error,
        "Unable to render Boundary Finder SQL.",
      ),
      sql: null,
    };
  }
}

function parseBoundaryFilterDrafts(
  filters: JdbcBoundaryFilterDefinition[],
  drafts: Record<string, string>,
): JdbcBoundaryFilterValues {
  const values: JdbcBoundaryFilterValues = {};

  for (const filter of filters) {
    const draft = drafts[filter.key] ?? "";

    if (filter.type === "boolean") {
      values[filter.key] = draft === "true";
    } else if (filter.type === "stringList" || filter.type === "integerList") {
      values[filter.key] = draft
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    } else {
      values[filter.key] = draft;
    }
  }

  return values;
}

function defaultBoundaryFilterDrafts(preset: JdbcBoundaryPreset) {
  return Object.fromEntries(
    preset.filters.map((filter) => [
      filter.key,
      defaultBoundaryFilterValue(filter),
    ]),
  );
}

function defaultBoundaryFilterValue(filter: JdbcBoundaryFilterDefinition) {
  switch (filter.type) {
    case "boolean":
      return "true";
    case "date":
      return "2026-05-01";
    case "decimal":
      return "10.5";
    case "integer":
      return "1";
    case "integerList":
      return "1, 2";
    case "stringList":
      return "ready, reviewed";
    case "timestamp":
      return "2026-05-29T10:30:00Z";
    case "string":
    default:
      return "sample_value";
  }
}

function boundaryFilterInputType(filter: JdbcBoundaryFilterDefinition) {
  if (filter.type === "date") {
    return "date";
  }

  if (filter.type === "decimal" || filter.type === "integer") {
    return "number";
  }

  return "text";
}

function boundaryFilterPlaceholder(filter: JdbcBoundaryFilterDefinition) {
  switch (filter.type) {
    case "date":
      return "2026-05-01";
    case "decimal":
      return "10.5";
    case "integer":
      return "1";
    case "integerList":
      return "1, 2";
    case "stringList":
      return "ready, reviewed";
    case "timestamp":
      return "2026-05-29T10:30:00Z";
    case "string":
    default:
      return "sample_value";
  }
}

function boundaryFilterHint(filter: JdbcBoundaryFilterDefinition) {
  const typeLabel =
    filter.type === "stringList" || filter.type === "integerList"
      ? `${filter.type}; comma-separated`
      : filter.type;

  return filter.description
    ? `${typeLabel}. ${filter.description}`
    : typeLabel;
}

function parseBoundaryNumber(value: string) {
  return value.trim() === "" ? Number.NaN : Number(value);
}
