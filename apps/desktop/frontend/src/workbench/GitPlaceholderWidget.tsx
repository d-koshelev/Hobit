import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import type { WidgetRenderProps } from "./types";

const plannedReviewCards = [
  {
    title: "Repository status",
    description:
      "Planned: branch, clean or dirty state, ahead/behind counts, and upstream context.",
  },
  {
    title: "Changed files",
    description:
      "Planned: staged, unstaged, and untracked file groups with readable change summaries.",
  },
  {
    title: "Validation results",
    description:
      "Planned: passed, failed, skipped, and warning states linked to the current block.",
  },
  {
    title: "Commit / push state",
    description:
      "Planned: reviewed commit message, commit hash when available, and push-needed state.",
  },
  {
    title: "Recovery actions",
    description:
      "Planned: explicit operator-controlled restore, revert, stash, reset, and clean flows.",
  },
];

export function GitPlaceholderWidget({
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  logRefreshToken,
  onLoadLogs,
  onStartFrameMove,
  title,
}: WidgetRenderProps) {
  return (
    <WidgetFrame
      actions={frameActions}
      logRefreshToken={logRefreshToken}
      moveEnabled={frameMoveEnabled}
      onLoadLogs={onLoadLogs ? () => onLoadLogs(instance.id) : undefined}
      onMoveStart={onStartFrameMove}
      style={frameStyle}
      status={<Badge variant="neutral">Placeholder</Badge>}
      subtitle="Git review placeholder"
      title={title}
    >
      <div className="empty-state">
        <p className="empty-state-title">Repository review planned</p>
        <p className="empty-state-text">
          Git review is planned. Repository status and Git commands are not
          connected yet.
        </p>
      </div>

      <div aria-label="Planned Git review areas" className="git-review-grid">
        {plannedReviewCards.map((card) => (
          <section className="git-review-card" key={card.title}>
            <div className="git-review-card-header">
              <h3 className="git-review-card-title">{card.title}</h3>
              <Badge variant="neutral">Planned</Badge>
            </div>
            <p className="git-review-card-text">{card.description}</p>
          </section>
        ))}
      </div>

      <div aria-label="Planned Git actions" className="git-action-row">
        <Button disabled variant="secondary">
          Review diff
        </Button>
        <Button disabled variant="secondary">
          Push
        </Button>
        <Button disabled variant="secondary">
          Create follow-up block
        </Button>
      </div>
    </WidgetFrame>
  );
}
