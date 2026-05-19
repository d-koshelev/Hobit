export type GenerateCoordinatorProviderResponseRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  operatorMessage: string;
  visibleConversation: CoordinatorProviderMessage[];
  visibleProposalDrafts: CoordinatorProviderProposalDraftContext[];
};

export type CoordinatorProviderMessage = {
  id: string;
  role: "operator" | "assistant";
  body: string;
};

export type CoordinatorProviderProposalDraftContext = {
  id: string;
  typeId: string;
  title: string;
  targetWidget: string;
  targetCapability: string;
  intent: string;
  visibleInputs: CoordinatorProviderVisibleInput[];
  riskNotes: string[];
  expectedResult: string;
};

export type CoordinatorProviderVisibleInput = {
  label: string;
  value: string;
};

export type GenerateCoordinatorProviderResponse = {
  requestId: string;
  assistantText: string;
  providerKind: string;
  providerStatus: string;
  providerError: string | null;
  allowedTools: string[];
  visibleContextMessageCount: number;
  visibleProposalDraftCount: number;
  proposalDrafts: CoordinatorProviderProposalDraftContext[];
  noToolsExecuted: boolean;
  noMutationsPerformed: boolean;
  noHiddenContextUsed: boolean;
};
