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
  STATUS_OPTIONS,
  databaseKindLabel,
  errorToMessage,
  formatUpdatedTimestamp,
} from "./jdbcConnectorWidgetModel";
import type { WidgetRenderProps } from "./types";

export function JdbcConnectorWidget({
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  logRefreshToken,
  onCreateJdbcConnector,
  onExecuteJdbcReadOnlyQuery,
  onGetJdbcConnector,
  onListJdbcConnectors,
  onLoadLogs,
  onStartFrameMove,
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
            <p className="jdbc-eyebrow">Preview database connector surface</p>
            <p className="jdbc-summary-text">
              Configure workspace-local connector metadata and run bounded
              mock read-only SQL through the JDBC widget. Real database
              connections, credentials, and AI result sharing are not enabled.
            </p>
          </div>
          <div className="jdbc-summary-badges">
            <Badge variant="info">Mock read-only</Badge>
            <Badge variant="warning">No secrets</Badge>
          </div>
        </section>

        <div className="jdbc-layout">
          <aside className="jdbc-list-pane" aria-label="JDBC connectors">
            <div className="jdbc-pane-header">
              <div>
                <p className="jdbc-pane-title">Connectors</p>
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
                  <p className="jdbc-empty-title">No connectors yet.</p>
                  <p className="jdbc-empty-text">
                    Create a connector metadata record before SQL workspace
                    slices arrive.
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
                        ? "Read-only default"
                        : "Read-only default off"}
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
                  Select a connector or create a new metadata record.
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
          onExecuteQuery={
            onExecuteJdbcReadOnlyQuery
              ? (request) => onExecuteJdbcReadOnlyQuery(instance.id, request)
              : undefined
          }
          onSelectConnector={selectConnector}
          onValidateSql={
            onValidateJdbcReadOnlySql
              ? (request) => onValidateJdbcReadOnlySql(instance.id, request)
              : undefined
          }
          selectedConnector={selectedConnector}
        />
      </div>
    </WidgetFrame>
  );
}
