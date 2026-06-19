//! Application orchestration layer for Hobit.
//!
//! This crate composes lower-level storage primitives into product-level use
//! cases. It does not expose frontend integration directly; desktop/Tauri
//! exposure is added in the desktop shell crate.

#![forbid(unsafe_code)]

pub mod artifacts;
pub mod audit_events;
pub mod capabilities;
pub mod context_packs;
mod error;
pub mod knowledge;
pub mod runtime_adapters;
mod workspace_service;

pub use artifacts::{
    ArtifactContentClass, ArtifactContextEligibility, ArtifactCoordinatorProposalRef,
    ArtifactDirectWorkRunRef, ArtifactEvidenceEligibility, ArtifactExternalSourceRef,
    ArtifactGitCommitRef, ArtifactGitDiffRef, ArtifactGitStatusRef, ArtifactId,
    ArtifactJdbcQueryRef, ArtifactJdbcResultRef, ArtifactNoteRef, ArtifactOrigin,
    ArtifactOwnerKind, ArtifactOwnerRef, ArtifactQueueTaskRef, ArtifactRef, ArtifactRefSummary,
    ArtifactResolutionStatus, ArtifactRetentionHint, ArtifactSensitivity, ArtifactSourceRef,
    ArtifactStorageKind, ArtifactTerminalRunRef, ArtifactTerminalSessionRef, ArtifactVisibility,
    ArtifactWidgetDefinitionRef, ArtifactWidgetInstanceRef, ArtifactWidgetLogRef,
    ArtifactWidgetResultRef, ArtifactWidgetRunRef, ArtifactWorkbenchRef, ArtifactWorkspaceRef,
};
pub use audit_events::{
    AuditActionRef, AuditActorKind, AuditActorRef, AuditApprovalId, AuditApprovalRef,
    AuditApprovalStatus, AuditArtifactId, AuditArtifactRef, AuditCapabilityRef, AuditCausationId,
    AuditCorrelationId, AuditErrorClass, AuditEventEnvelope, AuditEventId, AuditEventKind,
    AuditEventSummary, AuditOrganizationRef, AuditRiskLevel, AuditRunRef, AuditSchemaVersion,
    AuditTaskRef, AuditWidgetDefinitionRef, AuditWidgetInstanceRef, AuditWidgetRef,
    AuditWorkbenchRef, AuditWorkspaceRef,
};
pub use capabilities::{
    CapabilityActionCausation, CapabilityActionCorrelation, CapabilityActionId,
    CapabilityActionKind, CapabilityActionLifecycleStatus, CapabilityActionRef,
    CapabilityActionSummary, CapabilityActorId, CapabilityActorKind, CapabilityActorRef,
    CapabilityApprovalDecision, CapabilityApprovalRef, CapabilityApprovalRequirement,
    CapabilityArtifactPolicy, CapabilityBoundarySummary, CapabilityContextExposure,
    CapabilityExecutionMode, CapabilityExternalAccess, CapabilityId, CapabilityKind,
    CapabilityMutationScope, CapabilityRiskLevel, CapabilitySecretExposure, CapabilitySubjectRef,
    CapabilitySummary, CapabilityWidgetDefinitionRef, CapabilityWidgetInstanceRef,
    CapabilityWorkbenchRef, CapabilityWorkspaceRef, WidgetCapabilityRef, WorkspaceCapabilityRef,
};
pub use context_packs::{
    ContextPackEligibility, ContextPackExternalRef, ContextPackFreshness, ContextPackId,
    ContextPackItemKind, ContextPackItemRef, ContextPackRef, ContextPackReviewStatus,
    ContextPackSelectionReason, ContextPackSensitivity, ContextPackSharingScope,
    ContextPackSummary, ContextPackVisibility,
};
pub use error::WorkspaceServiceError;
pub use hobit_core::widgets::WidgetRunStatus;
pub use hobit_tools::codex_cli::CodexDirectStreamCancellationToken;
pub use knowledge::{
    EvidenceArtifactLink, EvidenceAttribution, EvidenceConfidence, EvidenceFreshness, EvidenceId,
    EvidenceRef, EvidenceReviewStatus, EvidenceSourceId, EvidenceSourceKind, EvidenceSourceRef,
    KnowledgeContextEligibility, KnowledgeContextSnapshot, KnowledgeContextSnapshotContentKind,
    KnowledgeDraftReviewDecision, KnowledgeDraftReviewDecisionKind, KnowledgeEvidenceLink,
    KnowledgeFinderSelectionSourceRef, KnowledgeFreshness, KnowledgeImportFileSourceRef,
    KnowledgeItemId, KnowledgeItemKind, KnowledgeItemRef, KnowledgeItemType,
    KnowledgeLifecycleStatus, KnowledgeManualSourceRef, KnowledgeModelParseError,
    KnowledgeNoteSourceRef, KnowledgeOwnerId, KnowledgeOwnerRef, KnowledgePathSourceRef,
    KnowledgeQueueRunSourceRef, KnowledgeQueueTaskSourceRef, KnowledgeRefSummary,
    KnowledgeRelation, KnowledgeReviewStatus, KnowledgeSafetyWarning,
    KnowledgeSafetyWarningSeverity, KnowledgeScope, KnowledgeSourceRef, KnowledgeVersionSummary,
    KnowledgeVisibility, KnowledgeWorkspaceRef, RunbookId, RunbookRef, SkillId, SkillRef,
    SkillReviewStatus, SkillVersionRef,
};
pub use runtime_adapters::{
    RuntimeAdapterId, RuntimeArtifactClass, RuntimeArtifactSummary, RuntimeCorrelationId,
    RuntimeErrorKind, RuntimeExecutionStatus, RuntimeKind, RuntimeRedactionStatus,
    RuntimeRequestId,
};
pub use workspace_service::{
    coordinator_provider_adapter_from_config, AckAgentQueueReviewMessageInput,
    AgentChatAiProposalProvider, AgentChatAiProposalRunSummary, AgentChatAiProviderOutcome,
    AgentChatAiRequestArtifact, AgentChatProposalActionInput, AgentChatProposalInput,
    AgentChatProposalRunSummary, AgentExecutorDiffFileSummary, AgentExecutorDiffSummary,
    AgentExecutorDiffTotals, AgentExecutorRunDetail, AgentExecutorRunHistory,
    AgentExecutorRunSummary, AgentMonitoringProposalActionSummary,
    AgentMonitoringProposalResultSummary, AgentMonitoringSnapshot,
    AgentQueueCompletionCommandBlocker, AgentQueueCompletionCommandResult,
    AgentQueueCompletionCommandStatus, AgentQueueCompletionDecisionSummary, AgentQueueItemSummary,
    AgentQueueProposalActionSummary, AgentQueueReviewCommandResult,
    AgentQueueReviewCreateMessageBlocker, AgentQueueReviewCreateMessageResult,
    AgentQueueReviewCreateMessageStatus, AgentQueueReviewMessageSummary, AgentQueueSnapshot,
    AgentQueueTaskRunLink, AgentQueueTaskRunLinkId, AgentQueueTaskRunReviewStatus,
    AgentQueueTaskRunSource, AgentQueueTaskRunStatus, AgentQueueTaskRunSummary,
    AgentQueueTaskSummary, AgentQueueValidationCommandEvidenceSummary,
    AgentQueueValidationCommandRunSummary, AgentQueueValidationCommandSpecInput,
    AgentQueueValidationSuiteRunSummary, AgentQueueWorkerEvidenceBundleSummary,
    AgentQueueWorkerEvidenceQueryResult, AgentQueueWorkerEvidenceQueryState,
    AgentQueueWorkerFinishedCommandResult, AgentQueueWorkerSummary,
    AssignAgentQueueTaskToExecutorInput, AssignedAgentQueueTaskRunPlan,
    AssignedAgentQueueTaskStartSummary, AttachKnowledgeToQueueTaskInput,
    AttachSkillToQueueTaskInput, CancelCodexDirectWorkRunInput, CheckJdbcSidecarHealthInput,
    ClearAgentQueueTaskAssignmentInput, CodexDirectWorkCancellationSummary,
    CodexDirectWorkForceKillSummary, CodexDirectWorkRunSummary, CodexDirectWorkStreamEventSummary,
    CodexDirectWorkStreamStartSummary, CoordinatorProviderAdapter, CoordinatorProviderMessage,
    CoordinatorProviderOutcome, CoordinatorProviderProposalDraftContext,
    CoordinatorProviderRequest, CoordinatorProviderResponse, CoordinatorProviderRuntimeConfig,
    CoordinatorProviderVisibleInput, CreateAgentQueueItemFromProposalInput,
    CreateAgentQueueReviewMessageInput, CreateAgentQueueTaskInput, CreateAgentQueueWorkerInput,
    CreateGitCommitInput, CreateJdbcConnectionProfileInput, CreateJdbcConnectorInput,
    CreateKnowledgeDocumentInput, CreateSkillInput, CreateWorkspaceGitCommitInput,
    CreateWorkspaceGitPushInput, CreateWorkspaceNoteInput, DeleteAgentQueueTaskInput,
    DeleteAgentQueueWorkerInput, DeleteJdbcConnectionProfileInput, DeleteKnowledgeDocumentInput,
    DeleteSkillInput, DetachKnowledgeFromQueueTaskInput, DetachSkillFromQueueTaskInput,
    DirectWorkValidationRunSummary, ExecuteJdbcReadOnlyQueryInput,
    ExternalCoordinatorProviderAdapter, ExternalCoordinatorProviderConfig,
    FinishAssignedAgentQueueTaskRunInput, ForceKillCodexDirectWorkRunInput,
    GenerateAgentChatAiProposalInput, GenerateCoordinatorProviderResponseInput,
    GetAgentQueueWorkerEvidenceBundleInput, GitBranchStatusSummary, GitCommitCommandSummary,
    GitCommitRunSummary, GitDiffCommandSummary, GitFileChangeSummary, GitFileDiffSummary,
    GitLastCommitSummary, GitLogEntrySummary, GitLogSummary, GitPushCommandSummary,
    GitPushRunSummary, GitRepositoryStatusSummary, GitWorkingTreeStatusSummary,
    JdbcConnectionProfileSummary, JdbcConnectorSummary, JdbcExperimentalSidecarRuntimeInput,
    JdbcQueryColumnSummary, JdbcReadOnlyQueryResultSummary, JdbcReadOnlySqlValidationSummary,
    JdbcSidecarDiagnosticSummary, KnowledgeDocumentSearchResultSummary, KnowledgeDocumentSummary,
    KnowledgeDraftReviewSummary, ListKnowledgeDraftReviewsInput, MarkAgentQueueItemDoneInput,
    MockCoordinatorProviderAdapter, PersistAgentChatProposalInput, ProbeJdbcDriverInput,
    QueueItemAggregate, QueueItemAggregateBlocker, QueueItemAggregateCommitState,
    QueueItemAggregateDependencyState, QueueItemAggregateDurableFlags,
    QueueItemAggregateEvidenceState, QueueItemAggregateEvidenceSummary,
    QueueItemAggregateLatestRun, QueueItemAggregateNextAction, QueueItemAggregateReviewState,
    QueueItemAggregateRunSettings, QueueItemAggregateTicketState,
    QueueItemAggregateValidationState, QueueItemAggregateWorkerRunState,
    RecordAgentQueueTaskRunFinalStatusInput, RecordAgentQueueTaskRunStartedInput,
    RecordAgentQueueWorkerFinishedInput, RecordKnowledgeDraftReviewInput,
    RunAgentQueueValidationSuiteInput, RunCodexDirectWorkInput, RunDirectWorkValidationInput,
    RunTerminalCommandInput, SearchKnowledgeDocumentsFiltersInput, SearchKnowledgeDocumentsInput,
    SharedStateObjectSummary, SkillSummary, StartAssignedAgentQueueTaskInput,
    TerminalCommandRunSummary, UpdateAgentQueueTaskInput, UpdateAgentQueueWorkerInput,
    UpdateJdbcConnectionProfileInput, UpdateJdbcConnectorInput, UpdateKnowledgeDocumentInput,
    UpdateSkillInput, UpdateWorkspaceNoteInput, ValidateJdbcReadOnlySqlInput, WidgetInstanceLayout,
    WidgetInstanceSummary, WidgetLogSummary, WidgetResultSummary, WidgetRunCommandInput,
    WidgetRunResultInput, WidgetRunSummary, WidgetRunWithResultsSummary, WorkbenchEventSummary,
    WorkbenchSummary, WorkspaceDeletionSummary, WorkspaceNoteSummary, WorkspaceService,
    WorkspaceSessionSummary, WorkspaceSummary, WorkspaceWorkbenchState,
    AGENT_QUEUE_ACCEPTED_COMPLETION_CONFIRMATION_TOKEN, AGENT_QUEUE_COMPLETION_DECISION_ACCEPTED,
    EXTERNAL_COORDINATOR_PROVIDER_KIND,
};
