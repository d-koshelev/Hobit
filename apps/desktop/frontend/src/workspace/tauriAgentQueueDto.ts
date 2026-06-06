import type {
  AgentQueueTaskExecutionPolicy,
  AgentQueueTaskStatus,
} from "./types";

export type TauriAgentQueueSnapshot = {
  workspace_id: string;
  workbench_id: string;
  items: TauriAgentQueueItem[];
};

export type TauriAgentQueueItem = {
  id: string;
  workspace_id: string;
  workbench_id: string;
  source_run_id: string;
  source_result_id: string;
  source_widget_instance_id: string;
  source_widget_title: string;
  title: string;
  status: string;
  decision_status: string;
  prompt_summary: string;
  proposal_summary: string;
  approved_context_summary: string;
  proposed_plan: string[];
  proposed_actions: TauriAgentQueueProposalAction[];
  proposal_only_mock: boolean;
  no_llm_called: boolean;
  no_tools_executed: boolean;
  no_mutations_performed: boolean;
  created_at: string;
  updated_at: string;
  payload_json: string;
};

export type TauriAgentQueueProposalAction = {
  title: string;
  description: string;
  status: string;
  executed: boolean;
};

export type TauriAgentQueueTask = {
  queue_item_id: string;
  workspace_id: string;
  title: string;
  description: string;
  prompt: string;
  status: AgentQueueTaskStatus;
  priority: number;
  execution_policy?: AgentQueueTaskExecutionPolicy | null;
  execution_workspace?: string | null;
  codex_executable?: string | null;
  sandbox?: string | null;
  approval_policy?: string | null;
  context_json?: string | null;
  assigned_executor_widget_id: string | null;
  created_at: string;
  updated_at: string;
};

export type TauriAgentQueueWorker = {
  worker_id: string;
  workspace_id: string;
  name: string;
  enabled: boolean;
  scope_kind: string;
  queue_tag_id: string | null;
  queue_tag_name: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type TauriStartAssignedAgentQueueTaskResponse = {
  workspace_id: string;
  queue_item_id: string;
  workbench_id: string;
  executor_widget_instance_id: string;
  run_id: string;
  status: string;
};

export type TauriAgentQueueTaskRunLink = {
  link_id: string;
  workspace_id: string;
  queue_task_id: string;
  executor_widget_id: string;
  direct_work_run_id: string;
  source: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  validation_status: string | null;
  review_status: string | null;
  created_at: string;
  updated_at: string;
};

export type TauriAgentQueueRunnerPolicy = {
  require_operator_start: boolean;
  one_task_at_a_time: boolean;
  stop_on_failure: boolean;
  stop_on_review_needed: boolean;
  stop_on_cancel: boolean;
  allow_hidden_execution: boolean;
  durable_resume: boolean;
};

export type TauriAgentQueueRunnerSnapshot = {
  session_id: string | null;
  status: string;
  is_active: boolean;
  is_session_only: boolean;
  policy: TauriAgentQueueRunnerPolicy;
  active_queue_item_id: string | null;
  waiting_run_id: string | null;
  final_run_status: string | null;
  last_reconciled_at: string | null;
  stop_reason: string | null;
};
