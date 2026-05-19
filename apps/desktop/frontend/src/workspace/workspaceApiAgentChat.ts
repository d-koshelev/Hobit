import { getWorkspaceApi } from "./workspaceApiRuntime";
import type {
  AgentMonitoringSnapshot,
  GenerateAgentChatAiProposalRequest,
  GenerateAgentChatAiProposalResponse,
  GetAgentMonitoringSnapshotRequest,
  PersistAgentChatProposalRequest,
  PersistAgentChatProposalResponse,
} from "./types";

export function getAgentMonitoringSnapshot(
  request: GetAgentMonitoringSnapshotRequest,
): Promise<AgentMonitoringSnapshot | null> {
  return getWorkspaceApi().getAgentMonitoringSnapshot(request);
}

export function persistAgentChatProposal(
  request: PersistAgentChatProposalRequest,
): Promise<PersistAgentChatProposalResponse | null> {
  return getWorkspaceApi().persistAgentChatProposal(request);
}

export function generateAgentChatAiProposal(
  request: GenerateAgentChatAiProposalRequest,
): Promise<GenerateAgentChatAiProposalResponse | null> {
  return getWorkspaceApi().generateAgentChatAiProposal(request);
}
