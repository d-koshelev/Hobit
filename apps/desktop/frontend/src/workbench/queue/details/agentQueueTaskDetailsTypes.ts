import type { useAgentQueueController } from "../useAgentQueueController";
import type { AgentQueueWorkerExecutionReport } from "../../../workspace/types";

export type AgentQueueController = ReturnType<typeof useAgentQueueController>;

export type SelectedAgentQueueTask = NonNullable<
  AgentQueueController["selectedTask"]
>;

export type AgentQueueDetailsBadgeVariant =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "error";

export type ActivityDisplayEntry = {
  badge: string;
  badgeVariant: AgentQueueDetailsBadgeVariant;
  key: string;
  message: string;
  title: string;
};

export type DirectWorkEvidence = {
  agentsSummary: string | null;
  changedFilesSummary: string | null;
  commandSummary: string | null;
  developerDetails: string | null;
  error: string | null;
  finalText: string;
  gitStatusSummary: string | null;
  outputExcerpt: string;
  status: "completed" | "failed";
  summary: string;
  visibleSummary: string;
  workingDirectory: string | null;
};

export type FinalResponseEvidence = {
  isLong: boolean;
  preview: string;
  text: string;
};

export type HumanTimelineEntry = {
  badge: string;
  badgeVariant: AgentQueueDetailsBadgeVariant;
  key: string;
  message: string;
  time?: string | null;
  title: string;
};

export type ResultEvidenceState = {
  badge: string;
  badgeVariant: AgentQueueDetailsBadgeVariant;
  copy: string;
  title: string;
};

export type WorkerExecutionReport = AgentQueueWorkerExecutionReport;
