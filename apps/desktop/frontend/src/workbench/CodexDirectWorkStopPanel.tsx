import { Button } from "../design-system/Button";

export function CodexDirectWorkStopPanel({
  isStopRequesting,
  onStopStreamingRun,
}: {
  isStopRequesting: boolean;
  onStopStreamingRun: () => void;
}) {
  return (
    <div className="codex-direct-work-stop-panel">
      <div className="codex-direct-work-copy">
        <p className="codex-direct-work-title">Active streaming run</p>
        <p className="codex-direct-work-text">
          Stop run attempts to stop the active Codex process. It does not reset
          files or undo changes already written.
        </p>
        <p className="codex-direct-work-review-note">
          Review Git status after cancellation if files may have changed.
        </p>
      </div>
      <Button
        disabled={isStopRequesting}
        onClick={onStopStreamingRun}
        variant="secondary"
      >
        {isStopRequesting ? "Stopping..." : "Stop run"}
      </Button>
    </div>
  );
}
