import type {
  CancelCodexDirectWorkRunResponse,
  DirectWorkStreamEvent,
  DirectWorkValidationProfile,
  ForceKillCodexDirectWorkRunResponse,
  RunCodexDirectWorkResponse,
  RunDirectWorkValidationResponse,
} from "../workspace/types";
import type { GetAgentExecutorDiffSummaryHandler } from "./CodexDirectWorkDiffSummary";
import type {
  CodexDirectWorkRequestDraft,
  CodexDirectWorkStreamSession,
} from "./CodexDirectWorkTypes";
import type { AgentActivityEvent } from "./agentActivityModel";
import type {
  AgentExecutorRunOpenRequest,
  CoordinatorAttachedContextInput,
  DirectWorkGitReviewRequestInput,
  DirectWorkGitReviewStatus,
  DirectWorkRunHandoff,
  WidgetInstanceId,
} from "./types";
import type {
  GetAgentExecutorRunDetailHandler,
  ListAgentExecutorRunsHandler,
} from "./AgentExecutorRunHistoryPanel";
import type { QueueLinkedDirectWorkEvidenceIngestionCallback } from "./queueLinkedDirectWorkEvidenceWiring";

export type CodexDirectWorkPanelProps = {
  agentExecutorRunOpenRequest?: AgentExecutorRunOpenRequest | null;
  gitReviewStatus?: DirectWorkGitReviewStatus | null;
  hasGitWidget?: boolean;
  onDirectWorkGitReviewRequested?: (
    request: DirectWorkGitReviewRequestInput,
  ) => void;
  onDirectWorkRunHandoffFinalState?: (
    handoff: DirectWorkRunHandoff,
    finalStatus: string,
  ) => void;
  onIngestQueueLinkedDirectWorkEvidence?: QueueLinkedDirectWorkEvidenceIngestionCallback;
  onGetAgentExecutorDiffSummary?: GetAgentExecutorDiffSummaryHandler;
  onGetAgentExecutorRunDetail?: GetAgentExecutorRunDetailHandler;
  onListAgentExecutorRuns?: ListAgentExecutorRunsHandler;
  onAttachContextToCoordinator?: (
    request: CoordinatorAttachedContextInput,
  ) => void;
  onPublishAgentActivityEvents?: (events: AgentActivityEvent[]) => void;
  onRunCodexDirectWork?: (
    widgetInstanceId: WidgetInstanceId,
    request: CodexDirectWorkRequestDraft,
  ) => Promise<RunCodexDirectWorkResponse | null>;
  onRunDirectWorkValidation?: (
    widgetInstanceId: WidgetInstanceId,
    request: {
      repoRoot: string;
      validationProfile: DirectWorkValidationProfile;
    },
  ) => Promise<RunDirectWorkValidationResponse | null>;
  onCancelCodexDirectWorkRun?: (
    widgetInstanceId: WidgetInstanceId,
    runId: string,
  ) => Promise<CancelCodexDirectWorkRunResponse | null>;
  onForceKillCodexDirectWorkRun?: (
    widgetInstanceId: WidgetInstanceId,
    runId: string,
  ) => Promise<ForceKillCodexDirectWorkRunResponse | null>;
  onAttachToCodexDirectWorkStream?: (
    widgetInstanceId: WidgetInstanceId,
    runId: string,
    onEvent: (event: DirectWorkStreamEvent) => void,
    signal?: AbortSignal,
  ) => Promise<CodexDirectWorkStreamSession | null>;
  onStartCodexDirectWorkStream?: (
    widgetInstanceId: WidgetInstanceId,
    request: CodexDirectWorkRequestDraft,
    onEvent: (event: DirectWorkStreamEvent) => void,
    signal?: AbortSignal,
  ) => Promise<CodexDirectWorkStreamSession | null>;
  directWorkRunHandoff?: DirectWorkRunHandoff | null;
  widgetInstanceId: WidgetInstanceId;
};
