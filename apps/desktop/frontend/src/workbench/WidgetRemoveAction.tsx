import { useId, useState } from "react";
import { Button } from "../design-system/Button";

type WidgetRemoveActionProps = {
  onRemove: () => Promise<void>;
  widgetTitle: string;
};

export function WidgetRemoveAction({
  onRemove,
  widgetTitle,
}: WidgetRemoveActionProps) {
  const confirmationId = useId();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function openConfirmation() {
    setErrorMessage(null);
    setIsConfirming(true);
  }

  function closeConfirmation() {
    if (isRemoving) {
      return;
    }

    setErrorMessage(null);
    setIsConfirming(false);
  }

  async function confirmRemoval() {
    if (isRemoving) {
      return;
    }

    setIsRemoving(true);
    setErrorMessage(null);

    try {
      await onRemove();
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
        disabled={isRemoving}
        onClick={openConfirmation}
        title={`Remove ${widgetTitle}`}
        variant="ghost"
      >
        Remove
      </Button>
      {isConfirming ? (
        <div
          aria-label="Remove widget confirmation"
          className="widget-remove-confirmation"
          id={confirmationId}
          role="alertdialog"
        >
          <p className="widget-remove-title">
            Remove this widget from the workbench?
          </p>
          <p className="widget-remove-text">
            This removes the widget and its local runs/logs/results. The
            workspace and other widgets are preserved. This cannot be undone.
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
              Keep
            </Button>
            <Button
              className="widget-remove-confirm-button"
              disabled={isRemoving}
              onClick={confirmRemoval}
              variant="secondary"
            >
              {isRemoving ? "Removing..." : "Remove widget"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatWidgetRemovalError(error: unknown) {
  const rawError = errorToString(error);
  const lowerError = rawError.toLowerCase();

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
