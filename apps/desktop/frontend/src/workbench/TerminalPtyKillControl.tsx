import { Button } from "../design-system/Button";

export function TerminalPtyKillControl({
  canKill,
  isKilling,
  killConfirmOpen,
  onCancelKill,
  onKill,
  onOpenKillConfirm,
}: {
  canKill: boolean;
  isKilling: boolean;
  killConfirmOpen: boolean;
  onCancelKill: () => void;
  onKill: () => void;
  onOpenKillConfirm: () => void;
}) {
  return (
    <span className="terminal-pty-kill-action">
      <Button
        className="terminal-pty-kill-button"
        disabled={!canKill}
        onClick={onOpenKillConfirm}
        variant="secondary"
      >
        Kill
      </Button>
      {killConfirmOpen ? (
        <span className="terminal-pty-kill-confirm" role="alert">
          <span className="terminal-run-notice-title">
            Force terminate session?
          </span>
          <span className="terminal-run-notice-text">
            Kill stops only the owned shell process. File changes already
            written by commands are not rolled back.
          </span>
          <span className="terminal-pty-kill-confirm-actions">
            <Button
              className="terminal-pty-kill-button"
              disabled={isKilling}
              onClick={onKill}
              variant="secondary"
            >
              {isKilling ? "Killing..." : "Confirm kill"}
            </Button>
            <Button disabled={isKilling} onClick={onCancelKill} variant="ghost">
              Cancel
            </Button>
          </span>
        </span>
      ) : null}
    </span>
  );
}
