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
    <>
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
    </>
  );
}
