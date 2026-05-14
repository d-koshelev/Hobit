import { Badge } from "../design-system/Badge";
import type {
  DirectWorkValidationProfile,
  RunDirectWorkValidationResponse,
} from "../workspace/types";
import { CodexDirectWorkDiffSummary } from "./CodexDirectWorkDiffSummary";
import type { GetAgentExecutorDiffSummaryHandler } from "./CodexDirectWorkDiffSummary";
import { CodexDirectWorkValidationPanel } from "./CodexDirectWorkValidationPanel";
import type { WidgetInstanceId } from "./types";

type CodexDirectWorkPostRunReviewProps = {
  onGetAgentExecutorDiffSummary?: GetAgentExecutorDiffSummaryHandler;
  onRunDirectWorkValidation?: (
    widgetInstanceId: WidgetInstanceId,
    request: {
      repoRoot: string;
      validationProfile: DirectWorkValidationProfile;
    },
  ) => Promise<RunDirectWorkValidationResponse | null>;
  repositoryRoot: string;
  widgetInstanceId: WidgetInstanceId;
};

export function CodexDirectWorkPostRunReview({
  onGetAgentExecutorDiffSummary,
  onRunDirectWorkValidation,
  repositoryRoot,
  widgetInstanceId,
}: CodexDirectWorkPostRunReviewProps) {
  return (
    <section
      aria-label="Direct Work post-run review"
      className="codex-direct-work-review-stack"
    >
      <div className="codex-direct-work-section-header">
        <div className="codex-direct-work-copy">
          <h3 className="codex-direct-work-title">Post-run review</h3>
          <p className="codex-direct-work-text">
            Inspect repository changes, load a read-only diff summary, and run
            validation without staging, committing, or pushing.
          </p>
        </div>
        <Badge variant="warning">Review</Badge>
      </div>

      <CodexDirectWorkDiffSummary
        onGetAgentExecutorDiffSummary={onGetAgentExecutorDiffSummary}
        repositoryRoot={repositoryRoot}
        widgetInstanceId={widgetInstanceId}
      />

      <CodexDirectWorkValidationPanel
        onRunDirectWorkValidation={onRunDirectWorkValidation}
        repositoryRoot={repositoryRoot}
        widgetInstanceId={widgetInstanceId}
      />
    </section>
  );
}
