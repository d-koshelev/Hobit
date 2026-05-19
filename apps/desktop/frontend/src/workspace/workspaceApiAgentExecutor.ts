import { getWorkspaceApi } from "./workspaceApiRuntime";
import type {
  AgentExecutorDiffSummary,
  AgentExecutorRunDetail,
  AgentExecutorRunHistory,
  GetAgentExecutorDiffSummaryRequest,
  GetAgentExecutorRunDetailRequest,
  ListAgentExecutorRunsRequest,
} from "./types";

export function listAgentExecutorRuns(
  request: ListAgentExecutorRunsRequest,
): Promise<AgentExecutorRunHistory | null> {
  return getWorkspaceApi().listAgentExecutorRuns(request);
}

export function getAgentExecutorRunDetail(
  request: GetAgentExecutorRunDetailRequest,
): Promise<AgentExecutorRunDetail | null> {
  return getWorkspaceApi().getAgentExecutorRunDetail(request);
}

export function getAgentExecutorDiffSummary(
  request: GetAgentExecutorDiffSummaryRequest,
): Promise<AgentExecutorDiffSummary | null> {
  return getWorkspaceApi().getAgentExecutorDiffSummary(request);
}
