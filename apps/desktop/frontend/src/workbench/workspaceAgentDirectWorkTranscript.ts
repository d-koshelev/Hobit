import type { CoordinatorActionProposal } from "./coordinatorActionProposalRegistry";
import { catalogActionProposalsFromText } from "./coordinatorCatalogActionDrafts";
import {
  directWorkFailureTranscriptBody,
  type CoordinatorDirectWorkStatus,
} from "./workspaceAgentDirectWorkModel";
import type { WorkspaceAgentRunMetadata } from "./workspaceAgentRunMetadata";
import {
  workspaceAgentQueueIntentDraftsFromText,
  type WorkspaceAgentQueueIntentDraft,
} from "./workspaceAgentQueueIntent";
import type { WorkspaceAgentTranscriptMessage } from "./WorkspaceAgentTranscript";

type AppendDirectWorkTranscriptInput = {
  createMessage: (
    role: WorkspaceAgentTranscriptMessage["role"],
    body: string,
  ) => WorkspaceAgentTranscriptMessage;
  reason: string;
  runMetadata?: WorkspaceAgentRunMetadata;
  setMessages: (
    updater: (
      currentMessages: WorkspaceAgentTranscriptMessage[],
    ) => WorkspaceAgentTranscriptMessage[],
  ) => void;
  setProposals: (
    updater: (
      currentProposals: Record<string, CoordinatorActionProposal>,
    ) => Record<string, CoordinatorActionProposal>,
  ) => void;
  setQueueIntentDrafts: (
    updater: (
      currentDrafts: Record<string, WorkspaceAgentQueueIntentDraft>,
    ) => Record<string, WorkspaceAgentQueueIntentDraft>,
  ) => void;
  status: CoordinatorDirectWorkStatus;
  useDirectBody?: boolean;
};

export function appendWorkspaceAgentDirectWorkTranscript({
  createMessage,
  reason,
  runMetadata,
  setMessages,
  setProposals,
  setQueueIntentDrafts,
  status,
  useDirectBody = false,
}: AppendDirectWorkTranscriptInput) {
  const body =
    status === "completed" || useDirectBody
      ? reason
      : status === "failed"
        ? directWorkFailureTranscriptBody(reason)
        : reason;
  const assistantMessage: WorkspaceAgentTranscriptMessage = {
    ...createMessage("assistant", body),
    runMetadata,
  };
  const catalogProposals = catalogActionProposalsFromText(
    body,
    assistantMessage.id,
  );
  const queueIntentDrafts = workspaceAgentQueueIntentDraftsFromText(
    body,
    assistantMessage.id,
    { source: "local_text" },
  );

  if (catalogProposals.length > 0) {
    setProposals((currentProposals) => ({
      ...currentProposals,
      ...Object.fromEntries(
        catalogProposals.map((proposal) => [proposal.id, proposal]),
      ),
    }));
    assistantMessage.proposalIds = catalogProposals.map((proposal) => proposal.id);
  }

  if (queueIntentDrafts.length > 0) {
    setQueueIntentDrafts((currentDrafts) => ({
      ...currentDrafts,
      ...Object.fromEntries(
        queueIntentDrafts.map((draft) => [draft.id, draft]),
      ),
    }));
    assistantMessage.queueIntentDraftIds = queueIntentDrafts.map(
      (draft) => draft.id,
    );
  }

  setMessages((currentMessages) => [...currentMessages, assistantMessage]);
}
