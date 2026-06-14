import { useId, useState } from "react";
import { Button } from "../design-system/Button";
import type {
  WidgetRemovalConfirmation,
  WidgetRemovalOptions,
} from "./widgetDeletionAction";

type WidgetRemoveActionProps = {
  getRemovalConfirmation?: () => Promise<WidgetRemovalConfirmation>;
  onRemove: (options?: WidgetRemovalOptions) => Promise<void>;
  widgetTitle: string;
};

export function WidgetRemoveAction({
  getRemovalConfirmation,
  onRemove,
  widgetTitle,
}: WidgetRemoveActionProps) {
  const confirmationId = useId();
  const [confirmation, setConfirmation] =
    useState<WidgetRemovalConfirmation | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function openConfirmation() {
    if (isInspecting || isRemoving) {
      return;
    }

    setErrorMessage(null);
    setIsInspecting(true);

    try {
      setConfirmation(
        getRemovalConfirmation
          ? await getRemovalConfirmation()
          : { kind: "normal" },
      );
      setIsConfirming(true);
    } catch (error) {
      setErrorMessage(formatWidgetRemovalInspectionError(error));
    } finally {
      setIsInspecting(false);
    }
  }

  function closeConfirmation() {
    if (isRemoving) {
      return;
    }

    setErrorMessage(null);
    setIsConfirming(false);
  }

  async function confirmRemoval() {
    if (isRemoving || !confirmation) {
      return;
    }

    setIsRemoving(true);
    setErrorMessage(null);

    try {
      await onRemove({
        forceKillTerminalSessions:
          confirmation.kind === "terminal-active-sessions",
      });
      setIsConfirming(false);
    } catch (error) {
      setErrorMessage(formatWidgetRemovalError(error));
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <div className="widget-remove-action" data-widget-header-drag-ignore>
      <Button
        aria-expanded={isConfirming}
        aria-controls={confirmationId}
        className="widget-remove-button"
        disabled={isInspecting || isRemoving}
        onClick={() => void openConfirmation()}
        title={`Remove ${widgetTitle}`}
        variant="ghost"
      >
        {isInspecting ? "Checking..." : "Remove"}
      </Button>
      {isConfirming ? (
        <div
          aria-label="Remove widget confirmation"
          className="widget-remove-confirmation"
          id={confirmationId}
          role="alertdialog"
        >
          <p className="widget-remove-title">
            {confirmation?.kind === "terminal-active-sessions"
              ? "Remove Terminal widget?"
              : "Remove this widget from the workbench?"}
          </p>
          <p className="widget-remove-text">
            {confirmation?.kind === "terminal-active-sessions"
              ? "This Terminal has running sessions. Force kill them before removing the widget?"
              : "This removes the widget and its local runs/logs/results. The workspace and other widgets are preserved. This cannot be undone."}
          </p>
          {errorMessage ? (
            <p className="widget-remove-error" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <div className="widget-remove-actions">
            <Button
              disabled={isRemoving}
              onClick={closeConfirmation}
              variant="ghost"
            >
              {confirmation?.kind === "terminal-active-sessions"
                ? "Cancel"
                : "Keep"}
            </Button>
            <Button
              className="widget-remove-confirm-button"
              disabled={isRemoving}
              onClick={confirmRemoval}
              variant="secondary"
            >
              {removalButtonLabel(confirmation, isRemoving)}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function removalButtonLabel(
  confirmation: WidgetRemovalConfirmation | null,
  isRemoving: boolean,
) {
  if (confirmation?.kind === "terminal-active-sessions") {
    return isRemoving ? "Force killing..." : "Force kill sessions and remove";
  }

  return isRemoving ? "Removing..." : "Remove widget";
}

function formatWidgetRemovalInspectionError(error: unknown) {
  return `Widget removal could not check current session state. ${errorToString(error)}`;
}

function formatWidgetRemovalError(error: unknown) {
  const rawError = errorToString(error);
  const lowerError = rawError.toLowerCase();

  if (lowerError.includes("terminal pty sessions could not be force killed")) {
    return `Terminal sessions could not be force killed. The widget was not removed. ${rawError}`;
  }

  if (lowerError.includes("terminal pty sessions are still running")) {
    return `Force kill running Terminal sessions before removing this widget. ${rawError}`;
  }

  if (lowerError.includes("direct work run is active")) {
    return `Stop or cancel the active Direct Work run before removing this widget. ${rawError}`;
  }

  if (lowerError.includes("agent queue review items")) {
    return `This widget is referenced by Agent Queue review items and cannot be removed yet. ${rawError}`;
  }

  if (lowerError.includes("only available in the tauri desktop shell")) {
    return `Widget removal is unsupported in the browser fallback. ${rawError}`;
  }

  if (lowerError.includes("not found") || lowerError.includes("ownership")) {
    return `This widget could not be found in the current workbench. ${rawError}`;
  }

  return `Widget could not be removed. ${rawError}`;
}

function errorToString(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error.";
  }
}
