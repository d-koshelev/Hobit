import type {
  AgentExecutorRunDetail,
  AgentExecutorRunHistory,
  AgentExecutorRunSummary,
} from "../../workspace/types";
import type { WidgetInstanceId } from "../types";
import type { AgentExecutorRunOpenRequest } from "../types";
import type { CoordinatorAttachedContextInput } from "../types";

export const AGENT_EXECUTOR_HISTORY_LIMIT = 20;
export const AGENT_EXECUTOR_LOG_PREVIEW_LIMIT = 50;
export const AGENT_EXECUTOR_OUTPUT_PREVIEW_LIMIT = 3000;

export type AgentExecutorHistoryState =
  | {
      message: string;
      status: "failed";
    }
  | {
      status: "loading";
    }
  | {
      runs: AgentExecutorRunSummary[];
      status: "ready";
    };

export type AgentExecutorRunDetailState =
  | {
      status: "idle";
    }
  | {
      runId: string;
      status: "loading";
    }
  | {
      detail: AgentExecutorRunDetail;
      status: "ready";
    }
  | {
      message: string;
      runId: string;
      status: "failed";
    };

export type GetAgentExecutorRunDetailHandler = (
  widgetInstanceId: WidgetInstanceId,
  runId: string,
) => Promise<AgentExecutorRunDetail | null>;

export type ListAgentExecutorRunsHandler = (
  widgetInstanceId: WidgetInstanceId,
  limit?: number,
) => Promise<AgentExecutorRunHistory | null>;

export type AgentExecutorRunHistoryPanelProps = {
  onGetAgentExecutorRunDetail?: GetAgentExecutorRunDetailHandler;
  onListAgentExecutorRuns?: ListAgentExecutorRunsHandler;
  onAttachContextToCoordinator?: (
    request: CoordinatorAttachedContextInput,
  ) => void;
  openRunDetailRequest?: AgentExecutorRunOpenRequest | null;
  refreshToken: number;
  widgetInstanceId: WidgetInstanceId;
};
