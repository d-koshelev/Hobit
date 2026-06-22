use hobit_core::widgets::WidgetRunStatus;
use hobit_storage_sqlite::SqliteStore;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

#[cfg(test)]
mod agent_ai_proposal_tests;
mod agent_ai_proposals;
mod agent_executor_diff;
#[cfg(test)]
mod agent_executor_diff_tests;
mod agent_executor_history;
#[cfg(test)]
mod agent_executor_history_tests;
mod agent_monitoring;
#[cfg(test)]
mod agent_monitoring_tests;
#[cfg(test)]
mod agent_proposal_tests;
mod agent_proposals;
mod agent_queue;
mod agent_queue_aggregate;
#[cfg(test)]
mod agent_queue_aggregate_tests;
mod agent_queue_completion;
#[cfg(test)]
mod agent_queue_completion_tests;
mod agent_queue_context;
#[cfg(test)]
mod agent_queue_context_tests;
mod agent_queue_control;
#[cfg(test)]
mod agent_queue_control_tests;
mod agent_queue_execution;
#[cfg(test)]
mod agent_queue_execution_tests;
mod agent_queue_failure;
#[cfg(test)]
mod agent_queue_failure_tests;
#[cfg(test)]
mod agent_queue_headless_contract_tests;
mod agent_queue_lifecycle;
#[cfg(test)]
mod agent_queue_lifecycle_tests;
mod agent_queue_review;
#[cfg(test)]
mod agent_queue_review_tests;
mod agent_queue_run_links;
#[cfg(test)]
mod agent_queue_run_links_tests;
mod agent_queue_task_dependencies;
#[cfg(test)]
mod agent_queue_task_policy_tests;
mod agent_queue_task_types;
mod agent_queue_tasks;
#[cfg(test)]
mod agent_queue_tasks_tests;
#[cfg(test)]
mod agent_queue_tests;
mod agent_queue_validation_runner;
#[cfg(test)]
mod agent_queue_validation_runner_tests;
mod agent_queue_worker_evidence;
#[cfg(test)]
mod agent_queue_worker_evidence_tests;
mod agent_queue_workers;
#[cfg(test)]
mod agent_queue_workers_tests;
mod agent_queue_workflow;
mod agent_queue_workflow_resume;
#[cfg(test)]
mod agent_queue_workflow_tests;
mod coordinator_provider;
mod coordinator_provider_drafts;
mod coordinator_provider_external;
mod coordinator_provider_runtime;
#[cfg(test)]
mod coordinator_provider_tests;
mod coordinator_provider_types;
mod direct_work;
mod direct_work_artifacts;
#[cfg(test)]
mod direct_work_artifacts_tests;
mod direct_work_cancellation;
#[cfg(test)]
mod direct_work_cancellation_tests;
mod direct_work_stream;
#[cfg(test)]
mod direct_work_stream_tests;
#[cfg(test)]
mod direct_work_tests;
mod direct_work_validation;
#[cfg(test)]
mod direct_work_validation_tests;
mod git;
mod git_artifacts;
#[cfg(test)]
mod git_artifacts_tests;
mod git_commit;
#[cfg(test)]
mod git_commit_tests;
mod git_push;
mod jdbc_artifacts;
#[cfg(test)]
mod jdbc_artifacts_tests;
mod jdbc_connection_profile_types;
mod jdbc_connection_profiles;
#[cfg(test)]
mod jdbc_connection_profiles_tests;
mod jdbc_connector_types;
mod jdbc_connectors;
#[cfg(test)]
mod jdbc_connectors_tests;
mod jdbc_diagnostics;
#[cfg(test)]
mod jdbc_diagnostics_tests;
mod jdbc_query;
#[cfg(test)]
mod jdbc_query_tests;
mod jdbc_query_types;
mod jdbc_runtime;
mod jdbc_runtime_config;
#[cfg(test)]
mod jdbc_runtime_config_tests;
#[cfg(test)]
mod jdbc_runtime_tests;
mod jdbc_sidecar_protocol;
#[cfg(test)]
mod jdbc_sidecar_protocol_tests;
mod knowledge_document_search;
mod knowledge_document_types;
mod knowledge_documents;
#[cfg(test)]
mod knowledge_documents_tests;
mod knowledge_draft_review_ledger;
#[cfg(test)]
mod knowledge_draft_review_ledger_tests;
mod knowledge_draft_review_types;
mod logs;
mod mapping;
mod notes;
#[cfg(test)]
mod notes_tests;
mod runs;
mod skills;
#[cfg(test)]
mod skills_tests;
mod terminal;
mod terminal_artifacts;
#[cfg(test)]
mod terminal_artifacts_tests;
mod terminal_pty;
#[cfg(test)]
mod terminal_pty_tests;
#[cfg(test)]
mod terminal_tests;
#[cfg(test)]
mod tests;
mod types;
mod validation;
#[cfg(test)]
mod widget_deletion_tests;
#[cfg(test)]
mod widget_singleton_tests;
mod widgets;
mod workbenches;
#[cfg(test)]
mod workspace_deletion_tests;
mod workspaces;
pub use agent_queue_aggregate::{
    QueueItemAggregate, QueueItemAggregateBlocker, QueueItemAggregateCommitState,
    QueueItemAggregateDependencyState, QueueItemAggregateDurableFlags,
    QueueItemAggregateEvidenceState, QueueItemAggregateEvidenceSummary,
    QueueItemAggregateLatestRun, QueueItemAggregateNextAction, QueueItemAggregateReviewState,
    QueueItemAggregateRunSettings, QueueItemAggregateTicketState,
    QueueItemAggregateValidationState, QueueItemAggregateWorkerRunState,
};
pub use agent_queue_completion::{
    AgentQueueCompletionCommandBlocker, AgentQueueCompletionCommandResult,
    AgentQueueCompletionCommandStatus, AgentQueueCompletionDecisionSummary,
    MarkAgentQueueItemDoneInput, AGENT_QUEUE_ACCEPTED_COMPLETION_CONFIRMATION_TOKEN,
    AGENT_QUEUE_COMPLETION_DECISION_ACCEPTED,
};
pub use agent_queue_control::{
    AgentQueueControlCommandBlocker, AgentQueueControlCommandStatus, AgentQueueControlStateSummary,
    SetAgentQueueControlStateInput, SetAgentQueueControlStateResult,
    AGENT_QUEUE_CONTROL_STATUS_DISABLED, AGENT_QUEUE_CONTROL_STATUS_MANUAL_ENABLED,
};
pub use agent_queue_failure::{
    AgentQueueFailureCommandBlocker, AgentQueueFailureCommandResult,
    AgentQueueFailureCommandStatus, AgentQueueFailureDecisionSummary, FailAgentQueueItemInput,
    AGENT_QUEUE_FAILURE_CONFIRMATION_TOKEN, AGENT_QUEUE_FAILURE_DECISION_FAILED,
};
pub use agent_queue_review::{
    AckAgentQueueReviewMessageInput, AgentQueueReviewCommandResult,
    AgentQueueReviewCreateMessageBlocker, AgentQueueReviewCreateMessageResult,
    AgentQueueReviewCreateMessageStatus, AgentQueueReviewMessageSummary,
    CreateAgentQueueReviewMessageInput,
};
pub use agent_queue_task_types::{
    AgentQueueTaskRunLink, AgentQueueTaskRunLinkId, AgentQueueTaskRunReviewStatus,
    AgentQueueTaskRunSource, AgentQueueTaskRunStatus, AgentQueueTaskRunSummary,
    AgentQueueTaskSummary, AgentQueueValidationCommandEvidenceSummary,
    AgentQueueValidationCommandRunSummary, AgentQueueValidationCommandSpecInput,
    AgentQueueValidationSuiteRunSummary, AgentQueueWorkerSummary,
    AssignAgentQueueTaskToExecutorInput, AssignedAgentQueueTaskRunPlan,
    AssignedAgentQueueTaskStartSummary, AttachKnowledgeToQueueTaskInput,
    AttachSkillToQueueTaskInput, ClearAgentQueueTaskAssignmentInput, CreateAgentQueueTaskInput,
    CreateAgentQueueWorkerInput, DeleteAgentQueueTaskInput, DeleteAgentQueueWorkerInput,
    DetachKnowledgeFromQueueTaskInput, DetachSkillFromQueueTaskInput,
    FinishAssignedAgentQueueTaskRunInput, QueueWorkerStartBlocker, QueueWorkerStartContext,
    QueueWorkerStartSettingsSnapshot, RecordAgentQueueTaskRunFinalStatusInput,
    RecordAgentQueueTaskRunStartedInput, RunAgentQueueValidationSuiteInput,
    StartAssignedAgentQueueTaskInput, UpdateAgentQueueTaskInput, UpdateAgentQueueWorkerInput,
};
pub use agent_queue_worker_evidence::{
    AgentQueueWorkerEvidenceBundleSummary, AgentQueueWorkerEvidenceQueryResult,
    AgentQueueWorkerEvidenceQueryState, AgentQueueWorkerFinishedCommandResult,
    GetAgentQueueWorkerEvidenceBundleInput, RecordAgentQueueWorkerFinishedInput,
};
pub use agent_queue_workflow::{
    QueueWorkflowAction, QueueWorkflowActionStatus, QueueWorkflowCancelRequest,
    QueueWorkflowCancelResult, QueueWorkflowCancelStatus, QueueWorkflowCommandBlocker,
    QueueWorkflowConflict, QueueWorkflowGetRequest, QueueWorkflowListRequest,
    QueueWorkflowRecordRunnerAction, QueueWorkflowRecordRunnerReportRequest,
    QueueWorkflowRecordRunnerReportResult, QueueWorkflowRecordRunnerReportStatus,
    QueueWorkflowReport, QueueWorkflowRun, QueueWorkflowRunStatus, QueueWorkflowStartRequest,
    QueueWorkflowStartResult, QueueWorkflowStartStatus, MAX_WORKFLOW_ACTION_LOG_SUMMARY_JSON_BYTES,
    MAX_WORKFLOW_GRANT_SUMMARY_JSON_BYTES, MAX_WORKFLOW_IDEMPOTENCY_KEYS_JSON_BYTES,
    MAX_WORKFLOW_INPUTS_JSON_BYTES, MAX_WORKFLOW_MUTATION_REFS_JSON_BYTES,
    MAX_WORKFLOW_SLOT_BINDINGS_JSON_BYTES, MAX_WORKFLOW_VARIABLES_JSON_BYTES,
};
pub use agent_queue_workflow_resume::{
    QueueWorkflowPlanResumeRequest, QueueWorkflowResumeBlocker, QueueWorkflowResumePlan,
    QueueWorkflowResumePlanStatus, QueueWorkflowSlotReconciliation,
    QueueWorkflowTaskResumeSnapshot,
};
pub use coordinator_provider::MockCoordinatorProviderAdapter;
pub use coordinator_provider_external::{
    ExternalCoordinatorProviderAdapter, ExternalCoordinatorProviderConfig,
    EXTERNAL_COORDINATOR_PROVIDER_KIND,
};
pub use coordinator_provider_runtime::{
    coordinator_provider_adapter_from_config, CoordinatorProviderRuntimeConfig,
};
pub use coordinator_provider_types::{
    CoordinatorProviderAdapter, CoordinatorProviderMessage, CoordinatorProviderOutcome,
    CoordinatorProviderProposalDraftContext, CoordinatorProviderRequest,
    CoordinatorProviderResponse, CoordinatorProviderVisibleInput,
    GenerateCoordinatorProviderResponseInput,
};
pub use jdbc_connection_profile_types::{
    CreateJdbcConnectionProfileInput, DeleteJdbcConnectionProfileInput,
    JdbcConnectionProfileSummary, UpdateJdbcConnectionProfileInput,
};
pub use jdbc_connector_types::{
    CreateJdbcConnectorInput, JdbcConnectorSummary, UpdateJdbcConnectorInput,
};
pub use jdbc_query_types::{
    CheckJdbcSidecarHealthInput, ExecuteJdbcReadOnlyQueryInput,
    JdbcExperimentalSidecarRuntimeInput, JdbcQueryColumnSummary, JdbcReadOnlyQueryResultSummary,
    JdbcReadOnlySqlValidationSummary, JdbcSidecarDiagnosticSummary, ProbeJdbcDriverInput,
    ValidateJdbcReadOnlySqlInput,
};
use jdbc_runtime_config::JdbcRuntimeConfig;
pub use knowledge_document_types::{
    CreateKnowledgeDocumentInput, DeleteKnowledgeDocumentInput,
    KnowledgeDocumentSearchResultSummary, KnowledgeDocumentSummary,
    SearchKnowledgeDocumentsFiltersInput, SearchKnowledgeDocumentsInput,
    UpdateKnowledgeDocumentInput,
};
pub use knowledge_draft_review_types::{
    KnowledgeDraftReviewSummary, ListKnowledgeDraftReviewsInput, RecordKnowledgeDraftReviewInput,
};
pub use types::{
    AgentChatAiProposalProvider, AgentChatAiProposalRunSummary, AgentChatAiProviderOutcome,
    AgentChatAiRequestArtifact, AgentChatProposalActionInput, AgentChatProposalInput,
    AgentChatProposalRunSummary, AgentExecutorDiffFileSummary, AgentExecutorDiffSummary,
    AgentExecutorDiffTotals, AgentExecutorRunDetail, AgentExecutorRunHistory,
    AgentExecutorRunSummary, AgentMonitoringProposalActionSummary,
    AgentMonitoringProposalResultSummary, AgentMonitoringSnapshot, AgentQueueItemSummary,
    AgentQueueProposalActionSummary, AgentQueueSnapshot, CancelCodexDirectWorkRunInput,
    CodexDirectWorkCancellationSummary, CodexDirectWorkForceKillSummary, CodexDirectWorkRunSummary,
    CodexDirectWorkStreamEventSummary, CodexDirectWorkStreamStartSummary,
    CreateAgentQueueItemFromProposalInput, CreateGitCommitInput, CreateSkillInput,
    CreateWorkspaceGitCommitInput, CreateWorkspaceGitPushInput, CreateWorkspaceNoteInput,
    DeleteSkillInput, DirectWorkValidationRunSummary, ForceKillCodexDirectWorkRunInput,
    GenerateAgentChatAiProposalInput, GitBranchStatusSummary, GitCommitCommandSummary,
    GitCommitRunSummary, GitDiffCommandSummary, GitFileChangeSummary, GitFileDiffSummary,
    GitLastCommitSummary, GitLogEntrySummary, GitLogSummary, GitPushCommandSummary,
    GitPushRunSummary, GitRepositoryStatusSummary, GitWorkingTreeStatusSummary,
    PersistAgentChatProposalInput, RunCodexDirectWorkInput, RunDirectWorkValidationInput,
    RunTerminalCommandInput, SharedStateObjectSummary, SkillSummary, TerminalCommandRunSummary,
    UpdateSkillInput, UpdateWorkspaceNoteInput, WidgetInstanceLayout, WidgetInstanceSummary,
    WidgetLogSummary, WidgetResultSummary, WidgetRunCommandInput, WidgetRunResultInput,
    WidgetRunSummary, WidgetRunWithResultsSummary, WorkbenchEventSummary, WorkbenchSummary,
    WorkspaceDeletionSummary, WorkspaceNoteSummary, WorkspaceSessionSummary, WorkspaceSummary,
    WorkspaceWorkbenchState,
};
static NEXT_ID_SUFFIX: AtomicU64 = AtomicU64::new(1);
const WORKBENCH_STATE_RECENT_EVENT_LIMIT: usize = 100;
const PLACEHOLDER_WIDGET_LAYOUT_MODE: &str = "docked";
const PLACEHOLDER_WIDGET_DOCK_X: i64 = 0;
const PLACEHOLDER_WIDGET_DOCK_WIDTH: i64 = 360;
const PLACEHOLDER_WIDGET_DOCK_HEIGHT: i64 = 240;
const PLACEHOLDER_WIDGET_DOCK_GAP: i64 = 16;
const PLACEHOLDER_WIDGET_CONFIG: &str = "{}";
const PLACEHOLDER_WIDGET_STATE: &str = "{}";
const WIDGET_LAYOUT_MODE_DOCKED: &str = "docked";
const WIDGET_LAYOUT_MODE_POPPED_OUT: &str = "popped_out";
const WIDGET_LAYOUT_MODE_MINIMIZED: &str = "minimized";
const MAX_WIDGET_LAYOUT_DIMENSION: i64 = 16_384;
const MAX_WIDGET_LOG_LIMIT: usize = 200;
const WIDGET_LOG_INFO_LEVEL: &str = "info";
const WIDGET_LOG_WIDGET_ADDED: &str = "Widget added";
const WIDGET_LOG_STATE_SAVED: &str = "Widget state saved";
const WIDGET_LOG_LAYOUT_UPDATED: &str = "Widget layout updated";
const WIDGET_RUN_STARTED_STATUS: WidgetRunStatus = WidgetRunStatus::Running;
const AGENT_CHAT_WIDGET_DEFINITION_ID: &str = "agent-chat";
const AGENT_CHAT_AI_PROPOSAL_COMMAND_KIND: &str = "agent_chat_ai_proposal";
const AGENT_CHAT_AI_PROPOSAL_RESULT_TYPE: &str = "agent_chat_ai_proposal_result";
const AGENT_CHAT_PROPOSAL_COMMAND_KIND: &str = "agent_chat_mock_proposal";
const AGENT_CHAT_PROPOSAL_RESULT_TYPE: &str = "agent_chat_mock_proposal_result";
const AGENT_CHAT_PROPOSAL_RUNTIME_STATUS: &str = "proposal_only_mock";
const COORDINATOR_CHAT_WIDGET_DEFINITION_ID: &str = "interactive-agent";
const AGENT_QUEUE_PROPOSAL_REVIEW_ITEM_KIND: &str = "agent_queue_proposal_review";
const AGENT_QUEUE_STATUS_NEEDS_REVIEW: &str = "needs_review";
const AGENT_QUEUE_DECISION_PENDING_REVIEW: &str = "pending_review";
const AGENT_QUEUE_WIDGET_DEFINITION_ID: &str = "agent-queue";
// Agent Executor reuses the internal agent-run id for persisted compatibility.
const AGENT_RUN_WIDGET_DEFINITION_ID: &str = "agent-run";
const GIT_WIDGET_DEFINITION_ID: &str = "git";
const JDBC_WIDGET_DEFINITION_ID: &str = "database-jdbc";
const TERMINAL_WIDGET_DEFINITION_ID: &str = "terminal";
pub struct WorkspaceService {
    store: SqliteStore,
    jdbc_runtime_config: JdbcRuntimeConfig,
}
impl WorkspaceService {
    pub fn new(store: SqliteStore) -> Self {
        Self {
            store,
            jdbc_runtime_config: JdbcRuntimeConfig::default(),
        }
    }
    #[allow(dead_code)]
    fn new_with_jdbc_runtime_config(
        store: SqliteStore,
        jdbc_runtime_config: JdbcRuntimeConfig,
    ) -> Self {
        Self {
            store,
            jdbc_runtime_config,
        }
    }
    #[cfg(test)]
    fn set_jdbc_runtime_config_for_tests(&mut self, jdbc_runtime_config: JdbcRuntimeConfig) {
        self.jdbc_runtime_config = jdbc_runtime_config;
    }
}
// Placeholder ID and timestamp strategy until Hobit selects a durable ID policy.
fn placeholder_id(prefix: &str) -> String {
    let suffix = NEXT_ID_SUFFIX.fetch_add(1, Ordering::Relaxed);
    format!("{prefix}{}_{}", unix_nanos(), suffix)
}
fn placeholder_timestamp() -> String {
    match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(duration) => format!("{}.{:09}", duration.as_secs(), duration.subsec_nanos()),
        Err(_) => "0.000000000".to_owned(),
    }
}
fn unix_nanos() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0)
}
