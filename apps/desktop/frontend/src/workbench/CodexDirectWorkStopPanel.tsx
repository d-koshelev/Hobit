import { Button } from "../design-system/Button";

export function CodexDirectWorkStopPanel({
  isKillConfirming,
  isKillRequesting,
  isStopRequesting,
  onCancelKill,
  onConfirmKill,
  onRequestKill,
  onStopStreamingRun,
}: {
  isKillConfirming: boolean;
  isKillRequesting: boolean;
  isStopRequesting: boolean;
  onCancelKill: () => void;
  onConfirmKill: () => void;
  onRequestKill: () => void;
  onStopStreamingRun: () => void;
}) {
  return (
    <div className="codex-direct-work-stop-panel">
      <div className="codex-direct-work-copy">
        <p className="codex-direct-work-title">Active streaming run</p>
        <p className="codex-direct-work-text">
          Stop requests cancellation. Kill force terminates the active Codex
          process when cancellation is stuck.
        </p>
        <p className="codex-direct-work-review-note">
          Files already written are not rolled back; check Git status after
          stopping or killing.
        </p>
      </div>
      <div className="codex-direct-work-stop-actions">
        <Button
          disabled={isStopRequesting || isKillRequesting}
          onClick={onStopStreamingRun}
          variant="secondary"
        >
          {isStopRequesting ? "Stopping..." : "Stop run"}
        </Button>
        <div className="codex-direct-work-kill-action">
          <Button
            aria-expanded={isKillConfirming}
            className="codex-direct-work-kill-button"
            disabled={isKillRequesting}
            onClick={onRequestKill}
            variant="secondary"
          >
            {isKillRequesting ? "Killing..." : "Kill"}
          </Button>
          {isKillConfirming ? (
            <div
              aria-label="Confirm force kill"
              className="codex-direct-work-kill-confirm"
              role="dialog"
            >
              <p className="codex-direct-work-title">Force kill Codex?</p>
              <p className="codex-direct-work-text">
                This force terminates the active Codex process. Files already
                written are not rolled back. Check Git status after killing.
              </p>
              <div className="codex-direct-work-kill-confirm-actions">
                <Button
                  className="codex-direct-work-kill-button"
                  disabled={isKillRequesting}
                  onClick={onConfirmKill}
                  variant="secondary"
                >
                  Force kill
                </Button>
                <Button
                  disabled={isKillRequesting}
                  onClick={onCancelKill}
                  variant="ghost"
                >
                  Keep running
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
