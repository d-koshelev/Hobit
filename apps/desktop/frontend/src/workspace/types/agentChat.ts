export type GetAgentMonitoringSnapshotRequest = {
  workspaceId: string;
  workbenchId: string;
};

export type PersistAgentChatProposalRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  operatorPrompt: string;
  approvedContextSnapshotJson: string;
  proposal: AgentChatProposalPersistPayload;
};

export type GenerateAgentChatAiProposalRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  operatorPrompt: string;
  approvedContextSnapshotJson: string;
};

export type AgentChatProposalPersistPayload = {
  actionProposals: AgentChatProposalActionPersistPayload[];
  contextNeeded: string[];
  id: string;
  proposedPlan: string[];
  requestSummary: string;
  runtimeNotes: string[];
  safetyNotes: string[];
};

export type AgentChatProposalActionPersistPayload = {
  description: string;
  title: string;
};

export type PersistAgentChatProposalResponse = {
  runId: string;
  status: string;
  resultId: string;
  resultType: string;
  summary: string;
};

export type GenerateAgentChatAiProposalResponse = {
  run: PersistAgentChatProposalResponse;
  proposal: AgentChatProposalPersistPayload;
  runtimeStatus: string;
  providerStatus: string;
  providerUsed: boolean;
  providerResponseReceived: boolean;
  noToolsExecuted: boolean;
  noMutationsPerformed: boolean;
  contextWasApproved: boolean;
  normalizationWarnings: string[];
};

export type AgentMonitoringSnapshot = {
  workspaceId: string;
  workbenchId: string;
  proposalResults: AgentMonitoringProposalResult[];
};

export type AgentMonitoringProposalResult = {
  runId: string;
  resultId: string;
  status: string;
  resultType: string;
  resultSummary: string | null;
  resultContent: string | null;
  runStartedAt: string;
  runFinishedAt: string | null;
  resultCreatedAt: string;
  sourceWidgetId: string;
  sourceWidgetTitle: string;
  runtimeStatus: string;
  providerStatus: string;
  providerUsed: boolean;
  providerResponseReceived: boolean;
  noLlmCalled: boolean;
  noToolsExecuted: boolean;
  noMutationsPerformed: boolean;
  contextWasApproved: boolean;
  operatorPrompt: string;
  proposalSummary: string;
  proposedPlan: string[];
  contextNeeded: string[];
  approvedContextSummary: string;
  approvedContextStatus: string;
  approvedContextSourceLabels: string[];
  proposedActions: AgentMonitoringProposalAction[];
  safetyNotes: string[];
  rawPayload: string;
};

export type AgentMonitoringProposalAction = {
  title: string;
  description: string;
  status: string;
  executed: boolean;
};
