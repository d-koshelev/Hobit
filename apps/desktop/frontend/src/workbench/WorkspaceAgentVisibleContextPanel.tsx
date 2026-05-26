import { Button } from "../design-system/Button";
import type { WorkspaceAgentVisibleContext } from "./workspaceAgentVisibleContext";

export function WorkspaceAgentVisibleContextPanel({
  context,
  onRemove,
}: {
  context: WorkspaceAgentVisibleContext | null;
  onRemove: () => void;
}) {
  if (!context) {
    return null;
  }

  return (
    <section
      aria-label="Visible attached context"
      className="interactive-agent-attached-context"
    >
      <div className="interactive-agent-attached-context-header">
        <div>
          <p className="interactive-agent-attached-context-kicker">
            Visible attached context
          </p>
          <p className="interactive-agent-attached-context-source">
            {context.sourceLabel}
          </p>
        </div>
        <Button onClick={onRemove} type="button" variant="ghost">
          Remove
        </Button>
      </div>
      <pre className="interactive-agent-attached-context-body">
        {context.contextText}
      </pre>
      <p className="interactive-agent-attached-context-note">
        Included in the message below. Edit or remove it before Send.
      </p>
    </section>
  );
}
