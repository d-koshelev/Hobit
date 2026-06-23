use hobit_storage_sqlite::{
    AgentQueueTaskRow, AgentQueueTaskUpdate, AgentQueueWorkflowRunReportUpdate,
    NewAgentQueueWorkflowAction,
};
use serde_json::{json, Map, Value};

use crate::WorkspaceServiceError;

use super::{
    agent_queue_lifecycle::{
        AGENT_QUEUE_TASK_EXECUTION_POLICY_MANUAL, AGENT_QUEUE_TASK_STATUS_DRAFT,
        AGENT_QUEUE_TASK_STATUS_QUEUED, AGENT_QUEUE_TASK_STATUS_READY,
    },
    agent_queue_tasks::{
        load_agent_executor_widget, map_storage_agent_queue_task_error, storage_invalid_input,
    },
    agent_queue_workflow::canonical_json_string,
    mapping::agent_queue_task_summary,
    placeholder_id, placeholder_timestamp, AgentQueueTaskSummary, QueueExecutionTargetSnapshot,
    QueueWorkerStartSettingsSnapshot, QueueWorkflowAction, QueueWorkflowActionStatus,
    QueueWorkflowCommandBlocker, QueueWorkflowConflict, QueueWorkflowRun, WorkspaceService,
    AGENT_QUEUE_WIDGET_DEFINITION_ID, MAX_WORKFLOW_SLOT_BINDINGS_JSON_BYTES,
};

const UPDATE_RUN_SETTINGS_ACTION_TYPE: &str = "update_run_settings";
const UPDATE_RUN_SETTINGS_STEP_ID: &str = "update_run_settings";
const PROMOTE_TASK_ACTION_TYPE: &str = "promote_task";
const PROMOTE_TASK_STEP_ID: &str = "promote_task";
const MAX_WORKFLOW_TASK_SLOT_CHARS: usize = 96;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowExecutionTarget {
    pub kind: String,
    pub provider_id: String,
    pub queue_owner_widget_instance_id: Option<String>,
    pub executor_widget_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowRunSettings {
    pub execution_workspace: String,
    pub codex_executable: String,
    pub sandbox: String,
    pub approval_policy: String,
    pub execution_policy: String,
    pub execution_target: Option<QueueWorkflowExecutionTarget>,
    pub executor_widget_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowApplyRunSettingsRequest {
    pub workspace_id: String,
    pub workflow_run_id: String,
    pub slot: String,
    pub task_id: Option<String>,
    pub run_settings: QueueWorkflowRunSettings,
    pub settings_hash: Option<String>,
    pub actor_id: Option<String>,
    pub action_idempotency_key: Option<String>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum QueueWorkflowApplyRunSettingsStatus {
    Applied,
    Reused,
    Conflict,
    Blocked,
    NotFound,
    InvalidInput,
}

impl QueueWorkflowApplyRunSettingsStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Applied => "applied",
            Self::Reused => "reused",
            Self::Conflict => "conflict",
            Self::Blocked => "blocked",
            Self::NotFound => "not_found",
            Self::InvalidInput => "invalid_input",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowRunSettingsBindingSummary {
    pub slot: String,
    pub task_id: String,
    pub settings_hash: String,
    pub execution_target_kind: String,
    pub provider_id: String,
    pub queue_owner_widget_instance_id: Option<String>,
    pub executor_widget_id: String,
    pub execution_target_hash: String,
    pub update_run_settings_action_id: Option<String>,
    pub update_run_settings_action_idempotency_key: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowApplyRunSettingsResult {
    pub status: QueueWorkflowApplyRunSettingsStatus,
    pub workflow_run: Option<QueueWorkflowRun>,
    pub task: Option<AgentQueueTaskSummary>,
    pub action: Option<QueueWorkflowAction>,
    pub binding: Option<QueueWorkflowRunSettingsBindingSummary>,
    pub blocker: Option<QueueWorkflowCommandBlocker>,
    pub conflict: Option<QueueWorkflowConflict>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowPromoteTaskSlotRequest {
    pub workspace_id: String,
    pub workflow_run_id: String,
    pub slot: String,
    pub task_id: Option<String>,
    pub task_spec_hash: String,
    pub settings_hash: String,
    pub actor_id: Option<String>,
    pub action_idempotency_key: Option<String>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum QueueWorkflowPromoteTaskSlotStatus {
    Promoted,
    Reused,
    Conflict,
    Blocked,
    NotFound,
    InvalidInput,
}

impl QueueWorkflowPromoteTaskSlotStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Promoted => "promoted",
            Self::Reused => "reused",
            Self::Conflict => "conflict",
            Self::Blocked => "blocked",
            Self::NotFound => "not_found",
            Self::InvalidInput => "invalid_input",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowPromoteTaskSlotBindingSummary {
    pub slot: String,
    pub task_id: String,
    pub task_spec_hash: String,
    pub settings_hash: String,
    pub promoted: bool,
    pub task_status: String,
    pub promote_action_id: Option<String>,
    pub promote_action_idempotency_key: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowPromoteTaskSlotResult {
    pub status: QueueWorkflowPromoteTaskSlotStatus,
    pub workflow_run: Option<QueueWorkflowRun>,
    pub task: Option<AgentQueueTaskSummary>,
    pub action: Option<QueueWorkflowAction>,
    pub binding: Option<QueueWorkflowPromoteTaskSlotBindingSummary>,
    pub blocker: Option<QueueWorkflowCommandBlocker>,
    pub conflict: Option<QueueWorkflowConflict>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) struct CanonicalQueueWorkflowRunSettings {
    pub execution_workspace: String,
    pub codex_executable: String,
    pub sandbox: String,
    pub approval_policy: String,
    pub execution_policy: String,
    pub execution_target: CanonicalQueueWorkflowExecutionTarget,
    pub executor_widget_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) struct CanonicalQueueWorkflowExecutionTarget {
    kind: CanonicalQueueWorkflowExecutionTargetKind,
    provider_id: String,
    queue_owner_widget_instance_id: Option<String>,
    executor_widget_id: Option<String>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum CanonicalQueueWorkflowExecutionTargetKind {
    QueueLocal,
    AgentExecutor,
}

impl CanonicalQueueWorkflowExecutionTargetKind {
    fn as_str(self) -> &'static str {
        match self {
            Self::QueueLocal => "queue_local",
            Self::AgentExecutor => "agent_executor",
        }
    }
}

impl CanonicalQueueWorkflowExecutionTarget {
    fn direct_work_owner_widget_id(&self) -> &str {
        match self.kind {
            CanonicalQueueWorkflowExecutionTargetKind::QueueLocal => self
                .queue_owner_widget_instance_id
                .as_deref()
                .unwrap_or_default(),
            CanonicalQueueWorkflowExecutionTargetKind::AgentExecutor => {
                self.executor_widget_id.as_deref().unwrap_or_default()
            }
        }
    }

    fn target_executor_widget_id_for_hash(&self) -> Option<String> {
        match self.kind {
            CanonicalQueueWorkflowExecutionTargetKind::QueueLocal => None,
            CanonicalQueueWorkflowExecutionTargetKind::AgentExecutor => {
                self.executor_widget_id.clone()
            }
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedApplyRunSettingsRequest {
    workspace_id: String,
    workflow_run_id: String,
    slot: String,
    task_id: Option<String>,
    run_settings: CanonicalQueueWorkflowRunSettings,
    settings_hash: String,
    actor_id: Option<String>,
    action_idempotency_key: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedPromoteTaskSlotRequest {
    workspace_id: String,
    workflow_run_id: String,
    slot: String,
    task_id: Option<String>,
    task_spec_hash: String,
    settings_hash: String,
    actor_id: Option<String>,
    action_idempotency_key: String,
}

impl WorkspaceService {
    pub fn apply_agent_queue_workflow_run_settings(
        &self,
        request: QueueWorkflowApplyRunSettingsRequest,
    ) -> Result<QueueWorkflowApplyRunSettingsResult, WorkspaceServiceError> {
        let request = match normalize_apply_run_settings_request(request) {
            Ok(request) => request,
            Err(blocker) => {
                return Ok(apply_result(
                    QueueWorkflowApplyRunSettingsStatus::InvalidInput,
                    None,
                    None,
                    None,
                    None,
                    Some(blocker),
                    None,
                ));
            }
        };

        let action_id = placeholder_id("queue-workflow-action-");
        let updated_at = placeholder_timestamp();

        let result = self
            .store
            .with_immediate_transaction(|store| {
                let Some(run) = store.get_agent_queue_workflow_run(
                    &request.workspace_id,
                    &request.workflow_run_id,
                )?
                else {
                    return Ok(apply_result(
                        QueueWorkflowApplyRunSettingsStatus::NotFound,
                        None,
                        None,
                        None,
                        None,
                        Some(blocker(
                            "workflow_run_not_found",
                            "Queue workflow run was not found for run settings setup.",
                            Some("workflowRunId"),
                        )),
                        None,
                    ));
                };

                if terminal_workflow_status(&run.status) {
                    return Ok(apply_result(
                        QueueWorkflowApplyRunSettingsStatus::Blocked,
                        Some(QueueWorkflowRun::from(run)),
                        None,
                        None,
                        None,
                        Some(blocker(
                            "workflow_run_terminal",
                            "Queue workflow run settings cannot be applied after the workflow is terminal.",
                            None,
                        )),
                        None,
                    ));
                }

                let mut slot_bindings = match parse_slot_bindings(run.slot_bindings_json.as_deref())
                {
                    Ok(bindings) => bindings,
                    Err(blocker) => {
                        return Ok(apply_result(
                            QueueWorkflowApplyRunSettingsStatus::InvalidInput,
                            Some(QueueWorkflowRun::from(run)),
                            None,
                            None,
                            None,
                            Some(blocker),
                            None,
                        ));
                    }
                };
                let Some(existing_binding) = slot_bindings.get(&request.slot).cloned() else {
                    return Ok(apply_result(
                        QueueWorkflowApplyRunSettingsStatus::Blocked,
                        Some(QueueWorkflowRun::from(run)),
                        None,
                        None,
                        None,
                        Some(blocker(
                            "slot_binding_missing",
                            "Queue workflow slot must be materialized before run settings are applied.",
                            Some("slot"),
                        )),
                        None,
                    ));
                };
                let Some(bound_task_id) = string_field(&existing_binding, "taskId").map(str::to_owned)
                else {
                    return Ok(apply_result(
                        QueueWorkflowApplyRunSettingsStatus::Blocked,
                        Some(QueueWorkflowRun::from(run)),
                        None,
                        None,
                        None,
                        Some(blocker(
                            "slot_binding_missing_task_id",
                            "Queue workflow slot binding is missing taskId.",
                            Some("slotBindings.taskId"),
                        )),
                        None,
                    ));
                };
                if request
                    .task_id
                    .as_deref()
                    .is_some_and(|task_id| task_id != bound_task_id)
                {
                    return Ok(apply_result(
                        QueueWorkflowApplyRunSettingsStatus::Blocked,
                        Some(QueueWorkflowRun::from(run)),
                        None,
                        None,
                        None,
                        Some(blocker(
                            "task_id_mismatch",
                            "Provided taskId does not match the materialized workflow slot binding.",
                            Some("taskId"),
                        )),
                        None,
                    ));
                }
                if let Some(existing_hash) = string_field(&existing_binding, "settingsHash") {
                    if existing_hash != request.settings_hash {
                        return Ok(apply_result(
                            QueueWorkflowApplyRunSettingsStatus::Conflict,
                            Some(QueueWorkflowRun::from(run)),
                            None,
                            None,
                            None,
                            None,
                            Some(settings_conflict(
                                &request,
                                "slot_settings_hash_conflict",
                                "Queue workflow slot already has different run settingsHash.",
                                Some(existing_hash),
                            )),
                        ));
                    }
                }
                if let Some(conflict) = same_slot_action_conflict(
                    store,
                    &request.workspace_id,
                    &request.workflow_run_id,
                    UPDATE_RUN_SETTINGS_ACTION_TYPE,
                    &request.slot,
                    "settingsHash",
                    &request.settings_hash,
                    "update_run_settings_action_ref_conflict",
                    "A Queue workflow update_run_settings action already exists for this slot with different typed refs.",
                )? {
                    return Ok(apply_result(
                        QueueWorkflowApplyRunSettingsStatus::Conflict,
                        Some(QueueWorkflowRun::from(run)),
                        None,
                        None,
                        None,
                        None,
                        Some(conflict),
                    ));
                }

                let target_refs_json = run_settings_target_refs_json(&request, &bound_task_id);
                let result_refs_json = run_settings_result_refs_json(&request, &bound_task_id);
                if let Some(existing_action) = store.get_agent_queue_workflow_action_by_idempotency_key(
                    &request.workflow_run_id,
                    &request.action_idempotency_key,
                )? {
                    if !workflow_action_matches(
                        &existing_action,
                        &request.workspace_id,
                        &request.workflow_run_id,
                        UPDATE_RUN_SETTINGS_STEP_ID,
                        UPDATE_RUN_SETTINGS_ACTION_TYPE,
                        &target_refs_json,
                        &result_refs_json,
                    ) {
                        return Ok(apply_result(
                            QueueWorkflowApplyRunSettingsStatus::Conflict,
                            Some(QueueWorkflowRun::from(run)),
                            None,
                            Some(QueueWorkflowAction::from(existing_action)),
                            None,
                            None,
                            Some(settings_conflict(
                                &request,
                                "update_run_settings_action_ref_conflict",
                                "A Queue workflow update_run_settings action already exists for this idempotency key with different typed refs.",
                                None,
                            )),
                        ));
                    }
                    if existing_action.status != QueueWorkflowActionStatus::Completed.as_str() {
                        return Ok(apply_result(
                            QueueWorkflowApplyRunSettingsStatus::Blocked,
                            Some(QueueWorkflowRun::from(run)),
                            None,
                            Some(QueueWorkflowAction::from(existing_action)),
                            None,
                            Some(blocker(
                                "update_run_settings_action_not_completed",
                                "Existing Queue workflow update_run_settings action is not completed and will not be retried blindly.",
                                None,
                            )),
                            None,
                        ));
                    }
                }

                let Some(task) = store.get_agent_queue_task(&request.workspace_id, &bound_task_id)?
                else {
                    return Ok(apply_result(
                        QueueWorkflowApplyRunSettingsStatus::Blocked,
                        Some(QueueWorkflowRun::from(run)),
                        None,
                        None,
                        None,
                        Some(blocker(
                            "bound_task_missing",
                            "Materialized Queue task was not found in the workflow workspace.",
                            Some("taskId"),
                        )),
                        None,
                    ));
                };

                if let Some(blocker) =
                    validate_task_configurable_for_run_settings(&task, &request)
                {
                    return Ok(apply_result(
                        QueueWorkflowApplyRunSettingsStatus::Blocked,
                        Some(QueueWorkflowRun::from(run)),
                        Some(agent_queue_task_summary(task)),
                        None,
                        None,
                        Some(blocker),
                        None,
                    ));
                }

                validate_workflow_execution_target_owner(
                    store,
                    &request.workspace_id,
                    &request.run_settings.execution_target,
                )?;

                let existing_action = store.get_agent_queue_workflow_action_by_idempotency_key(
                    &request.workflow_run_id,
                    &request.action_idempotency_key,
                )?;
                let (task, action, status) = if let Some(existing_action) = existing_action {
                    if let Some(blocker) = durable_settings_mismatch(&task, &request.run_settings) {
                        return Ok(apply_result(
                            QueueWorkflowApplyRunSettingsStatus::Blocked,
                            Some(QueueWorkflowRun::from(run)),
                            Some(agent_queue_task_summary(task)),
                            Some(QueueWorkflowAction::from(existing_action)),
                            None,
                            Some(blocker),
                            None,
                        ));
                    }
                    (
                        task,
                        existing_action,
                        QueueWorkflowApplyRunSettingsStatus::Reused,
                    )
                } else {
                    let task = store
                        .update_agent_queue_task(
                            &request.workspace_id,
                            &bound_task_id,
                            AgentQueueTaskUpdate {
                                title: &task.title,
                                description: &task.description,
                                prompt: &task.prompt,
                                status: &task.status,
                                priority: task.priority,
                                depends_on: Some(&task.depends_on),
                                execution_policy: Some(&request.run_settings.execution_policy),
                                execution_workspace: Some(&request.run_settings.execution_workspace),
                                codex_executable: Some(&request.run_settings.codex_executable),
                                sandbox: Some(&request.run_settings.sandbox),
                                approval_policy: Some(&request.run_settings.approval_policy),
                                context_json: None,
                                updated_at: Some(&updated_at),
                            },
                        )?
                        .ok_or(hobit_storage_sqlite::StorageError::QueryReturnedNoRows)?;
                    let task = if request.run_settings.executor_widget_id.is_empty()
                        || task.assigned_executor_widget_id.as_deref()
                            == Some(request.run_settings.executor_widget_id.as_str())
                    {
                        task
                    } else {
                        store
                            .assign_agent_queue_task_to_executor(
                                &request.workspace_id,
                                &bound_task_id,
                                &request.run_settings.executor_widget_id,
                                Some(&updated_at),
                            )?
                            .ok_or(hobit_storage_sqlite::StorageError::QueryReturnedNoRows)?
                    };
                    let action =
                        store.insert_agent_queue_workflow_action(NewAgentQueueWorkflowAction {
                            action_id: &action_id,
                            workflow_run_id: &request.workflow_run_id,
                            workspace_id: &request.workspace_id,
                            step_id: UPDATE_RUN_SETTINGS_STEP_ID,
                            action_type: UPDATE_RUN_SETTINGS_ACTION_TYPE,
                            idempotency_key: &request.action_idempotency_key,
                            status: QueueWorkflowActionStatus::Completed.as_str(),
                            target_refs_json: Some(&target_refs_json),
                            result_refs_json: Some(&result_refs_json),
                            blocker_code: None,
                            blocker_message: None,
                            attempt_count: 1,
                            started_at: Some(&updated_at),
                            completed_at: Some(&updated_at),
                            created_at: Some(&updated_at),
                            updated_at: Some(&updated_at),
                        })?;
                    (
                        task,
                        action,
                        QueueWorkflowApplyRunSettingsStatus::Applied,
                    )
                };

                let execution_target_hash =
                    workflow_execution_target_hash(&request.run_settings.execution_target);
                let binding = QueueWorkflowRunSettingsBindingSummary {
                    slot: request.slot.clone(),
                    task_id: bound_task_id.clone(),
                    settings_hash: request.settings_hash.clone(),
                    execution_target_kind: request
                        .run_settings
                        .execution_target
                        .kind
                        .as_str()
                        .to_owned(),
                    provider_id: request.run_settings.execution_target.provider_id.clone(),
                    queue_owner_widget_instance_id: request
                        .run_settings
                        .execution_target
                        .queue_owner_widget_instance_id
                        .clone(),
                    executor_widget_id: request.run_settings.executor_widget_id.clone(),
                    execution_target_hash,
                    update_run_settings_action_id: Some(action.action_id.clone()),
                    update_run_settings_action_idempotency_key: request
                        .action_idempotency_key
                        .clone(),
                };
                let mut binding_value = existing_binding;
                apply_run_settings_to_binding(&mut binding_value, &request, &binding);
                slot_bindings.insert(request.slot.clone(), binding_value);
                let slot_bindings_json = canonical_json_string(&Value::Object(slot_bindings));
                if slot_bindings_json.len() > MAX_WORKFLOW_SLOT_BINDINGS_JSON_BYTES {
                    return Ok(apply_result(
                        QueueWorkflowApplyRunSettingsStatus::InvalidInput,
                        Some(QueueWorkflowRun::from(run)),
                        Some(agent_queue_task_summary(task)),
                        Some(QueueWorkflowAction::from(action)),
                        None,
                        Some(blocker(
                            "slot_bindings_too_large",
                            "Queue workflow slot bindings exceed the configured byte limit.",
                            Some("slotBindings"),
                        )),
                        None,
                    ));
                }

                let updated_run = store
                    .update_agent_queue_workflow_run_report(
                        &request.workspace_id,
                        &request.workflow_run_id,
                        AgentQueueWorkflowRunReportUpdate {
                            status: &run.status,
                            phase: None,
                            current_step: None,
                            pause_reason: None,
                            blocker_reason: None,
                            variables_json: None,
                            slot_bindings_json: Some(&slot_bindings_json),
                            mutation_refs_json: None,
                            idempotency_keys_json: None,
                            action_log_summary_json: None,
                            updated_at: Some(&updated_at),
                            completed_at: None,
                        },
                    )?
                    .ok_or(hobit_storage_sqlite::StorageError::QueryReturnedNoRows)?;
                store.touch_workspace(&request.workspace_id)?;

                Ok(apply_result(
                    status,
                    Some(QueueWorkflowRun::from(updated_run)),
                    Some(agent_queue_task_summary(task)),
                    Some(QueueWorkflowAction::from(action)),
                    Some(binding),
                    None,
                    None,
                ))
            })
            .map_err(map_storage_agent_queue_task_error)?;

        Ok(result)
    }

    pub fn promote_agent_queue_workflow_task_slot(
        &self,
        request: QueueWorkflowPromoteTaskSlotRequest,
    ) -> Result<QueueWorkflowPromoteTaskSlotResult, WorkspaceServiceError> {
        let request = match normalize_promote_task_slot_request(request) {
            Ok(request) => request,
            Err(blocker) => {
                return Ok(promote_result(
                    QueueWorkflowPromoteTaskSlotStatus::InvalidInput,
                    None,
                    None,
                    None,
                    None,
                    Some(blocker),
                    None,
                ));
            }
        };

        let action_id = placeholder_id("queue-workflow-action-");
        let updated_at = placeholder_timestamp();

        let result = self
            .store
            .with_immediate_transaction(|store| {
                let Some(run) = store.get_agent_queue_workflow_run(
                    &request.workspace_id,
                    &request.workflow_run_id,
                )?
                else {
                    return Ok(promote_result(
                        QueueWorkflowPromoteTaskSlotStatus::NotFound,
                        None,
                        None,
                        None,
                        None,
                        Some(blocker(
                            "workflow_run_not_found",
                            "Queue workflow run was not found for task promotion.",
                            Some("workflowRunId"),
                        )),
                        None,
                    ));
                };

                if terminal_workflow_status(&run.status) {
                    return Ok(promote_result(
                        QueueWorkflowPromoteTaskSlotStatus::Blocked,
                        Some(QueueWorkflowRun::from(run)),
                        None,
                        None,
                        None,
                        Some(blocker(
                            "workflow_run_terminal",
                            "Queue workflow tasks cannot be promoted after the workflow is terminal.",
                            None,
                        )),
                        None,
                    ));
                }

                let mut slot_bindings = match parse_slot_bindings(run.slot_bindings_json.as_deref())
                {
                    Ok(bindings) => bindings,
                    Err(blocker) => {
                        return Ok(promote_result(
                            QueueWorkflowPromoteTaskSlotStatus::InvalidInput,
                            Some(QueueWorkflowRun::from(run)),
                            None,
                            None,
                            None,
                            Some(blocker),
                            None,
                        ));
                    }
                };
                let Some(existing_binding) = slot_bindings.get(&request.slot).cloned() else {
                    return Ok(promote_result(
                        QueueWorkflowPromoteTaskSlotStatus::Blocked,
                        Some(QueueWorkflowRun::from(run)),
                        None,
                        None,
                        None,
                        Some(blocker(
                            "slot_binding_missing",
                            "Queue workflow slot must be materialized before promotion.",
                            Some("slot"),
                        )),
                        None,
                    ));
                };
                let Some(bound_task_id) = string_field(&existing_binding, "taskId").map(str::to_owned)
                else {
                    return Ok(promote_result(
                        QueueWorkflowPromoteTaskSlotStatus::Blocked,
                        Some(QueueWorkflowRun::from(run)),
                        None,
                        None,
                        None,
                        Some(blocker(
                            "slot_binding_missing_task_id",
                            "Queue workflow slot binding is missing taskId.",
                            Some("slotBindings.taskId"),
                        )),
                        None,
                    ));
                };
                if request
                    .task_id
                    .as_deref()
                    .is_some_and(|task_id| task_id != bound_task_id)
                {
                    return Ok(promote_result(
                        QueueWorkflowPromoteTaskSlotStatus::Blocked,
                        Some(QueueWorkflowRun::from(run)),
                        None,
                        None,
                        None,
                        Some(blocker(
                            "task_id_mismatch",
                            "Provided taskId does not match the materialized workflow slot binding.",
                            Some("taskId"),
                        )),
                        None,
                    ));
                }
                if string_field(&existing_binding, "taskSpecHash")
                    .is_some_and(|hash| hash != request.task_spec_hash)
                {
                    return Ok(promote_result(
                        QueueWorkflowPromoteTaskSlotStatus::Conflict,
                        Some(QueueWorkflowRun::from(run)),
                        None,
                        None,
                        None,
                        None,
                        Some(promote_conflict(
                            &request,
                            "task_spec_hash_conflict",
                            "Provided taskSpecHash does not match the materialized slot binding.",
                            string_field(&existing_binding, "taskSpecHash"),
                            Some(&request.task_spec_hash),
                        )),
                    ));
                }
                if string_field(&existing_binding, "settingsHash")
                    .is_some_and(|hash| hash != request.settings_hash)
                {
                    return Ok(promote_result(
                        QueueWorkflowPromoteTaskSlotStatus::Conflict,
                        Some(QueueWorkflowRun::from(run)),
                        None,
                        None,
                        None,
                        None,
                        Some(promote_conflict(
                            &request,
                            "settings_hash_conflict",
                            "Provided settingsHash does not match the workflow slot settings binding.",
                            string_field(&existing_binding, "settingsHash"),
                            Some(&request.settings_hash),
                        )),
                    ));
                }
                if string_field(&existing_binding, "settingsHash").is_none() {
                    return Ok(promote_result(
                        QueueWorkflowPromoteTaskSlotStatus::Blocked,
                        Some(QueueWorkflowRun::from(run)),
                        None,
                        None,
                        None,
                        Some(blocker(
                            "run_settings_missing",
                            "Queue workflow slot must have applied run settings before promotion.",
                            Some("settingsHash"),
                        )),
                        None,
                    ));
                }
                if let Some(conflict) = same_slot_action_conflict(
                    store,
                    &request.workspace_id,
                    &request.workflow_run_id,
                    PROMOTE_TASK_ACTION_TYPE,
                    &request.slot,
                    "settingsHash",
                    &request.settings_hash,
                    "promote_task_action_ref_conflict",
                    "A Queue workflow promote_task action already exists for this slot with different typed refs.",
                )? {
                    return Ok(promote_result(
                        QueueWorkflowPromoteTaskSlotStatus::Conflict,
                        Some(QueueWorkflowRun::from(run)),
                        None,
                        None,
                        None,
                        None,
                        Some(conflict),
                    ));
                }

                let Some(task) = store.get_agent_queue_task(&request.workspace_id, &bound_task_id)?
                else {
                    return Ok(promote_result(
                        QueueWorkflowPromoteTaskSlotStatus::Blocked,
                        Some(QueueWorkflowRun::from(run)),
                        None,
                        None,
                        None,
                        Some(blocker(
                            "bound_task_missing",
                            "Materialized Queue task was not found in the workflow workspace.",
                            Some("taskId"),
                        )),
                        None,
                    ));
                };
                if let Some(blocker) = durable_promote_settings_mismatch(&task, &existing_binding, &request) {
                    return Ok(promote_result(
                        QueueWorkflowPromoteTaskSlotStatus::Blocked,
                        Some(QueueWorkflowRun::from(run)),
                        Some(agent_queue_task_summary(task)),
                        None,
                        None,
                        Some(blocker),
                        None,
                    ));
                }
                if !matches!(
                    task.status.as_str(),
                    AGENT_QUEUE_TASK_STATUS_DRAFT
                        | AGENT_QUEUE_TASK_STATUS_QUEUED
                        | AGENT_QUEUE_TASK_STATUS_READY
                ) {
                    return Ok(promote_result(
                        QueueWorkflowPromoteTaskSlotStatus::Blocked,
                        Some(QueueWorkflowRun::from(run)),
                        Some(agent_queue_task_summary(task)),
                        None,
                        None,
                        Some(blocker(
                            "task_not_promotable",
                            "Workflow task promotion only accepts draft, queued, or ready tasks.",
                            Some("task.status"),
                        )),
                        None,
                    ));
                }

                let target_refs_json = promote_target_refs_json(&request, &bound_task_id);
                if let Some(existing_action) = store.get_agent_queue_workflow_action_by_idempotency_key(
                    &request.workflow_run_id,
                    &request.action_idempotency_key,
                )? {
                    if !workflow_action_target_matches(
                        &existing_action,
                        &request.workspace_id,
                        &request.workflow_run_id,
                        PROMOTE_TASK_STEP_ID,
                        PROMOTE_TASK_ACTION_TYPE,
                        &target_refs_json,
                    ) {
                        return Ok(promote_result(
                            QueueWorkflowPromoteTaskSlotStatus::Conflict,
                            Some(QueueWorkflowRun::from(run)),
                            Some(agent_queue_task_summary(task)),
                            Some(QueueWorkflowAction::from(existing_action)),
                            None,
                            None,
                            Some(promote_conflict(
                                &request,
                                "promote_task_action_ref_conflict",
                                "A Queue workflow promote_task action already exists for this idempotency key with different typed refs.",
                                None,
                                None,
                            )),
                        ));
                    }
                    if existing_action.status != QueueWorkflowActionStatus::Completed.as_str() {
                        return Ok(promote_result(
                            QueueWorkflowPromoteTaskSlotStatus::Blocked,
                            Some(QueueWorkflowRun::from(run)),
                            Some(agent_queue_task_summary(task)),
                            Some(QueueWorkflowAction::from(existing_action)),
                            None,
                            Some(blocker(
                                "promote_task_action_not_completed",
                                "Existing Queue workflow promote_task action is not completed and will not be retried blindly.",
                                None,
                            )),
                            None,
                        ));
                    }
                }

                let existing_action = store.get_agent_queue_workflow_action_by_idempotency_key(
                    &request.workflow_run_id,
                    &request.action_idempotency_key,
                )?;
                let (task, action, status, promote_status) = if let Some(existing_action) = existing_action {
                    (
                        task,
                        existing_action,
                        QueueWorkflowPromoteTaskSlotStatus::Reused,
                        "reused",
                    )
                } else {
                    let (task, promote_status) = if task.status == AGENT_QUEUE_TASK_STATUS_DRAFT {
                        (
                            store
                                .update_agent_queue_task_status(
                                    &request.workspace_id,
                                    &bound_task_id,
                                    AGENT_QUEUE_TASK_STATUS_QUEUED,
                                    Some(&updated_at),
                                )?
                                .ok_or(hobit_storage_sqlite::StorageError::QueryReturnedNoRows)?,
                            "promoted",
                        )
                    } else {
                        (task, "already_promoted")
                    };
                    let result_refs_json =
                        promote_result_refs_json(&bound_task_id, &task.status, promote_status);
                    let action =
                        store.insert_agent_queue_workflow_action(NewAgentQueueWorkflowAction {
                            action_id: &action_id,
                            workflow_run_id: &request.workflow_run_id,
                            workspace_id: &request.workspace_id,
                            step_id: PROMOTE_TASK_STEP_ID,
                            action_type: PROMOTE_TASK_ACTION_TYPE,
                            idempotency_key: &request.action_idempotency_key,
                            status: QueueWorkflowActionStatus::Completed.as_str(),
                            target_refs_json: Some(&target_refs_json),
                            result_refs_json: Some(&result_refs_json),
                            blocker_code: None,
                            blocker_message: None,
                            attempt_count: 1,
                            started_at: Some(&updated_at),
                            completed_at: Some(&updated_at),
                            created_at: Some(&updated_at),
                            updated_at: Some(&updated_at),
                        })?;
                    (
                        task,
                        action,
                        QueueWorkflowPromoteTaskSlotStatus::Promoted,
                        promote_status,
                    )
                };

                let binding = QueueWorkflowPromoteTaskSlotBindingSummary {
                    slot: request.slot.clone(),
                    task_id: bound_task_id.clone(),
                    task_spec_hash: request.task_spec_hash.clone(),
                    settings_hash: request.settings_hash.clone(),
                    promoted: true,
                    task_status: task.status.clone(),
                    promote_action_id: Some(action.action_id.clone()),
                    promote_action_idempotency_key: request.action_idempotency_key.clone(),
                };
                let mut binding_value = existing_binding;
                apply_promote_to_binding(
                    &mut binding_value,
                    &request,
                    &binding,
                    promote_status,
                    &updated_at,
                );
                slot_bindings.insert(request.slot.clone(), binding_value);
                let slot_bindings_json = canonical_json_string(&Value::Object(slot_bindings));
                if slot_bindings_json.len() > MAX_WORKFLOW_SLOT_BINDINGS_JSON_BYTES {
                    return Ok(promote_result(
                        QueueWorkflowPromoteTaskSlotStatus::InvalidInput,
                        Some(QueueWorkflowRun::from(run)),
                        Some(agent_queue_task_summary(task)),
                        Some(QueueWorkflowAction::from(action)),
                        None,
                        Some(blocker(
                            "slot_bindings_too_large",
                            "Queue workflow slot bindings exceed the configured byte limit.",
                            Some("slotBindings"),
                        )),
                        None,
                    ));
                }

                let updated_run = store
                    .update_agent_queue_workflow_run_report(
                        &request.workspace_id,
                        &request.workflow_run_id,
                        AgentQueueWorkflowRunReportUpdate {
                            status: &run.status,
                            phase: None,
                            current_step: None,
                            pause_reason: None,
                            blocker_reason: None,
                            variables_json: None,
                            slot_bindings_json: Some(&slot_bindings_json),
                            mutation_refs_json: None,
                            idempotency_keys_json: None,
                            action_log_summary_json: None,
                            updated_at: Some(&updated_at),
                            completed_at: None,
                        },
                    )?
                    .ok_or(hobit_storage_sqlite::StorageError::QueryReturnedNoRows)?;
                store.touch_workspace(&request.workspace_id)?;

                Ok(promote_result(
                    status,
                    Some(QueueWorkflowRun::from(updated_run)),
                    Some(agent_queue_task_summary(task)),
                    Some(QueueWorkflowAction::from(action)),
                    Some(binding),
                    None,
                    None,
                ))
            })
            .map_err(map_storage_agent_queue_task_error)?;

        Ok(result)
    }
}

pub(super) fn normalize_queue_workflow_run_settings_for_hash(
    settings: QueueWorkflowRunSettings,
) -> Result<(CanonicalQueueWorkflowRunSettings, String), String> {
    let settings = normalize_run_settings(settings).map_err(|blocker| blocker.blocker_message)?;
    let settings_hash = workflow_run_settings_hash(&settings);
    Ok((settings, settings_hash))
}

pub(super) fn workflow_run_settings_hash(settings: &CanonicalQueueWorkflowRunSettings) -> String {
    QueueWorkerStartSettingsSnapshot {
        execution_workspace: settings.execution_workspace.clone(),
        codex_executable: settings.codex_executable.clone(),
        sandbox: settings.sandbox.clone(),
        approval_policy: settings.approval_policy.clone(),
        execution_policy: settings.execution_policy.clone(),
        execution_target_kind: settings.execution_target.kind.as_str().to_owned(),
        provider_id: settings.execution_target.provider_id.clone(),
        queue_owner_widget_instance_id: settings
            .execution_target
            .queue_owner_widget_instance_id
            .clone(),
        executor_widget_id: settings
            .execution_target
            .target_executor_widget_id_for_hash()
            .unwrap_or_default(),
    }
    .stable_hash()
}

pub(super) fn workflow_execution_target_hash(
    target: &CanonicalQueueWorkflowExecutionTarget,
) -> String {
    QueueExecutionTargetSnapshot {
        execution_target_kind: target.kind.as_str().to_owned(),
        provider_id: target.provider_id.clone(),
        queue_owner_widget_instance_id: target.queue_owner_widget_instance_id.clone(),
        executor_widget_id: target.target_executor_widget_id_for_hash(),
    }
    .stable_hash()
}

fn normalize_apply_run_settings_request(
    request: QueueWorkflowApplyRunSettingsRequest,
) -> Result<NormalizedApplyRunSettingsRequest, QueueWorkflowCommandBlocker> {
    let workspace_id = required_owned(request.workspace_id, "workspaceId")?;
    let workflow_run_id = required_owned(request.workflow_run_id, "workflowRunId")?;
    let slot = normalize_slot(request.slot, "slot")?;
    let run_settings = normalize_run_settings(request.run_settings)?;
    let settings_hash = workflow_run_settings_hash(&run_settings);
    if let Some(provided_hash) = normalize_optional_string(request.settings_hash) {
        if provided_hash != settings_hash {
            return Err(blocker(
                "settings_hash_mismatch",
                "Provided settingsHash does not match canonical typed runSettings.",
                Some("settingsHash"),
            ));
        }
    }
    let action_idempotency_key =
        format!("{workflow_run_id}:{UPDATE_RUN_SETTINGS_ACTION_TYPE}:{slot}:{settings_hash}");
    if let Some(provided_key) = normalize_optional_string(request.action_idempotency_key) {
        if provided_key != action_idempotency_key {
            return Err(blocker(
                "invalid_action_idempotency_key",
                "Queue workflow run settings idempotency key must be workflowRunId:update_run_settings:slot:settingsHash.",
                Some("actionIdempotencyKey"),
            ));
        }
    }

    Ok(NormalizedApplyRunSettingsRequest {
        workspace_id,
        workflow_run_id,
        slot,
        task_id: normalize_optional_string(request.task_id),
        run_settings,
        settings_hash,
        actor_id: normalize_optional_string(request.actor_id),
        action_idempotency_key,
    })
}

fn normalize_promote_task_slot_request(
    request: QueueWorkflowPromoteTaskSlotRequest,
) -> Result<NormalizedPromoteTaskSlotRequest, QueueWorkflowCommandBlocker> {
    let workspace_id = required_owned(request.workspace_id, "workspaceId")?;
    let workflow_run_id = required_owned(request.workflow_run_id, "workflowRunId")?;
    let slot = normalize_slot(request.slot, "slot")?;
    let task_spec_hash = required_owned(request.task_spec_hash, "taskSpecHash")?;
    let settings_hash = required_owned(request.settings_hash, "settingsHash")?;
    let action_idempotency_key = format!(
        "{workflow_run_id}:{PROMOTE_TASK_ACTION_TYPE}:{slot}:{task_spec_hash}:{settings_hash}"
    );
    if let Some(provided_key) = normalize_optional_string(request.action_idempotency_key) {
        if provided_key != action_idempotency_key {
            return Err(blocker(
                "invalid_action_idempotency_key",
                "Queue workflow promote idempotency key must be workflowRunId:promote_task:slot:taskSpecHash:settingsHash.",
                Some("actionIdempotencyKey"),
            ));
        }
    }

    Ok(NormalizedPromoteTaskSlotRequest {
        workspace_id,
        workflow_run_id,
        slot,
        task_id: normalize_optional_string(request.task_id),
        task_spec_hash,
        settings_hash,
        actor_id: normalize_optional_string(request.actor_id),
        action_idempotency_key,
    })
}

fn normalize_run_settings(
    settings: QueueWorkflowRunSettings,
) -> Result<CanonicalQueueWorkflowRunSettings, QueueWorkflowCommandBlocker> {
    let execution_workspace = required_owned(
        settings.execution_workspace,
        "runSettings.executionWorkspace",
    )?;
    let codex_executable =
        required_owned(settings.codex_executable, "runSettings.codexExecutable")?;
    let sandbox = required_owned(settings.sandbox, "runSettings.sandbox")?;
    match sandbox.as_str() {
        "read_only" | "workspace_write" | "danger_full_access" => {}
        _ => {
            return Err(blocker(
                "unsupported_task_sandbox",
                "Queue workflow run settings include an unsupported sandbox value.",
                Some("runSettings.sandbox"),
            ));
        }
    }
    let approval_policy = required_owned(settings.approval_policy, "runSettings.approvalPolicy")?;
    match approval_policy.as_str() {
        "never" | "on_request" | "untrusted" => {}
        _ => {
            return Err(blocker(
                "unsupported_task_approval_policy",
                "Queue workflow run settings include an unsupported approvalPolicy value.",
                Some("runSettings.approvalPolicy"),
            ));
        }
    }
    let execution_policy =
        required_owned(settings.execution_policy, "runSettings.executionPolicy")?;
    if execution_policy != AGENT_QUEUE_TASK_EXECUTION_POLICY_MANUAL {
        return Err(blocker(
            "unsupported_workflow_execution_policy",
            "Queue workflow setup only accepts manual executionPolicy in this phase.",
            Some("runSettings.executionPolicy"),
        ));
    }
    let execution_target =
        normalize_execution_target(settings.execution_target, settings.executor_widget_id)?;
    let executor_widget_id = execution_target.direct_work_owner_widget_id().to_owned();

    Ok(CanonicalQueueWorkflowRunSettings {
        execution_workspace,
        codex_executable,
        sandbox,
        approval_policy,
        execution_policy,
        execution_target,
        executor_widget_id,
    })
}

fn normalize_execution_target(
    execution_target: Option<QueueWorkflowExecutionTarget>,
    legacy_executor_widget_id: String,
) -> Result<CanonicalQueueWorkflowExecutionTarget, QueueWorkflowCommandBlocker> {
    if let Some(target) = execution_target {
        let kind = required_owned(target.kind, "runSettings.executionTarget.kind")?;
        let provider_id =
            required_owned(target.provider_id, "runSettings.executionTarget.providerId")?;
        if provider_id != "codex" {
            return Err(blocker(
                "unsupported_execution_target_provider",
                "Queue workflow setup only accepts the codex provider for executionTarget.",
                Some("runSettings.executionTarget.providerId"),
            ));
        }

        return match kind.as_str() {
            "queue_local" => {
                let queue_owner_widget_instance_id =
                    normalize_optional_string(target.queue_owner_widget_instance_id);
                if normalize_optional_string(target.executor_widget_id).is_some() {
                    return Err(blocker(
                        "invalid_execution_target",
                        "Queue-local workflow executionTarget must not include executorWidgetId.",
                        Some("runSettings.executionTarget.executorWidgetId"),
                    ));
                }
                Ok(CanonicalQueueWorkflowExecutionTarget {
                    kind: CanonicalQueueWorkflowExecutionTargetKind::QueueLocal,
                    provider_id,
                    queue_owner_widget_instance_id,
                    executor_widget_id: None,
                })
            }
            "agent_executor" => {
                let executor_widget_id =
                    normalize_optional_string(target.executor_widget_id).ok_or_else(|| {
                        blocker(
                            "missing_execution_target_executor",
                            "Legacy agent_executor workflow executionTarget requires executorWidgetId.",
                            Some("runSettings.executionTarget.executorWidgetId"),
                        )
                    })?;
                if normalize_optional_string(target.queue_owner_widget_instance_id).is_some() {
                    return Err(blocker(
                        "invalid_execution_target",
                        "Legacy agent_executor workflow executionTarget must not include queueOwnerWidgetInstanceId.",
                        Some("runSettings.executionTarget.queueOwnerWidgetInstanceId"),
                    ));
                }
                Ok(CanonicalQueueWorkflowExecutionTarget {
                    kind: CanonicalQueueWorkflowExecutionTargetKind::AgentExecutor,
                    provider_id,
                    queue_owner_widget_instance_id: None,
                    executor_widget_id: Some(executor_widget_id),
                })
            }
            _ => Err(blocker(
                "unsupported_execution_target_kind",
                "Queue workflow setup only accepts queue_local or agent_executor executionTarget.kind.",
                Some("runSettings.executionTarget.kind"),
            )),
        };
    }

    let executor_widget_id =
        required_owned(legacy_executor_widget_id, "runSettings.executorWidgetId")?;
    Ok(CanonicalQueueWorkflowExecutionTarget {
        kind: CanonicalQueueWorkflowExecutionTargetKind::AgentExecutor,
        provider_id: "codex".to_owned(),
        queue_owner_widget_instance_id: None,
        executor_widget_id: Some(executor_widget_id),
    })
}

fn validate_workflow_execution_target_owner(
    store: &hobit_storage_sqlite::SqliteStore,
    workspace_id: &str,
    target: &CanonicalQueueWorkflowExecutionTarget,
) -> Result<(), hobit_storage_sqlite::StorageError> {
    match target.kind {
        CanonicalQueueWorkflowExecutionTargetKind::QueueLocal => {
            let Some(queue_owner_widget_instance_id) =
                target.queue_owner_widget_instance_id.as_deref()
            else {
                return Ok(());
            };
            let Some(widget) = store.get_widget_instance(queue_owner_widget_instance_id)? else {
                return Err(storage_invalid_input(format!(
                    "queue owner widget not found: {queue_owner_widget_instance_id}"
                )));
            };

            if widget.workspace_id != workspace_id {
                return Err(storage_invalid_input(format!(
                    "queue owner widget does not belong to workspace: {queue_owner_widget_instance_id}"
                )));
            }

            if widget.definition_id != AGENT_QUEUE_WIDGET_DEFINITION_ID {
                return Err(storage_invalid_input(format!(
                    "queue-local execution target is not an Agent Queue widget: {queue_owner_widget_instance_id}"
                )));
            }

            Ok(())
        }
        CanonicalQueueWorkflowExecutionTargetKind::AgentExecutor => load_agent_executor_widget(
            store,
            workspace_id,
            target.executor_widget_id.as_deref().unwrap_or_default(),
        )
        .map(|_| ()),
    }
}

fn validate_task_configurable_for_run_settings(
    task: &AgentQueueTaskRow,
    request: &NormalizedApplyRunSettingsRequest,
) -> Option<QueueWorkflowCommandBlocker> {
    if task.status != AGENT_QUEUE_TASK_STATUS_DRAFT {
        if durable_settings_mismatch(task, &request.run_settings).is_none() {
            return None;
        }
        return Some(blocker(
            "task_not_configurable",
            "Workflow run settings can only configure draft tasks unless the same settings are already durable.",
            Some("task.status"),
        ));
    }
    if let Some(existing) = task.execution_workspace.as_deref() {
        if existing != request.run_settings.execution_workspace {
            return Some(blocker(
                "run_settings_conflict",
                "Durable task executionWorkspace already differs from workflow run settings.",
                Some("runSettings.executionWorkspace"),
            ));
        }
    }
    if let Some(existing) = task.codex_executable.as_deref() {
        if existing != request.run_settings.codex_executable {
            return Some(blocker(
                "run_settings_conflict",
                "Durable task codexExecutable already differs from workflow run settings.",
                Some("runSettings.codexExecutable"),
            ));
        }
    }
    if let Some(existing) = task.sandbox.as_deref() {
        if existing != request.run_settings.sandbox {
            return Some(blocker(
                "run_settings_conflict",
                "Durable task sandbox already differs from workflow run settings.",
                Some("runSettings.sandbox"),
            ));
        }
    }
    if let Some(existing) = task.approval_policy.as_deref() {
        if existing != request.run_settings.approval_policy {
            return Some(blocker(
                "run_settings_conflict",
                "Durable task approvalPolicy already differs from workflow run settings.",
                Some("runSettings.approvalPolicy"),
            ));
        }
    }
    if task.execution_policy != request.run_settings.execution_policy {
        return Some(blocker(
            "run_settings_conflict",
            "Durable task executionPolicy already differs from workflow run settings.",
            Some("runSettings.executionPolicy"),
        ));
    }
    if let Some(existing) = task.assigned_executor_widget_id.as_deref() {
        if existing != request.run_settings.executor_widget_id {
            return Some(blocker(
                "executor_assignment_conflict",
                "Durable task executor assignment already differs from workflow run settings.",
                Some("runSettings.executorWidgetId"),
            ));
        }
    }

    None
}

fn durable_promote_settings_mismatch(
    task: &AgentQueueTaskRow,
    binding: &Value,
    request: &NormalizedPromoteTaskSlotRequest,
) -> Option<QueueWorkflowCommandBlocker> {
    let Some(settings) = run_settings_from_binding(binding) else {
        return Some(blocker(
            "run_settings_binding_missing",
            "Workflow slot binding is missing the bounded runSettings snapshot.",
            Some("runSettings"),
        ));
    };
    if settings.executor_widget_id != task.assigned_executor_widget_id.clone().unwrap_or_default() {
        return Some(blocker(
            "executor_widget_mismatch",
            "Workflow slot executorWidgetId does not match durable task assignment.",
            Some("executorWidgetId"),
        ));
    }
    let actual_hash = workflow_run_settings_hash(&settings);
    if actual_hash != request.settings_hash {
        return Some(blocker(
            "settings_hash_mismatch",
            "Workflow slot settingsHash does not match durable task run settings.",
            Some("settingsHash"),
        ));
    }
    durable_settings_mismatch(task, &settings)
}

fn durable_settings_mismatch(
    task: &AgentQueueTaskRow,
    settings: &CanonicalQueueWorkflowRunSettings,
) -> Option<QueueWorkflowCommandBlocker> {
    for (field, durable, expected) in [
        (
            "runSettings.executionWorkspace",
            task.execution_workspace.as_deref(),
            settings.execution_workspace.as_str(),
        ),
        (
            "runSettings.codexExecutable",
            task.codex_executable.as_deref(),
            settings.codex_executable.as_str(),
        ),
        (
            "runSettings.sandbox",
            task.sandbox.as_deref(),
            settings.sandbox.as_str(),
        ),
        (
            "runSettings.approvalPolicy",
            task.approval_policy.as_deref(),
            settings.approval_policy.as_str(),
        ),
    ] {
        if durable != Some(expected) {
            return Some(blocker(
                "settings_durable_mismatch",
                "Durable task run settings no longer match the workflow settingsHash.",
                Some(field),
            ));
        }
    }
    if task.execution_policy != settings.execution_policy {
        return Some(blocker(
            "settings_durable_mismatch",
            "Durable task executionPolicy no longer matches the workflow settingsHash.",
            Some("runSettings.executionPolicy"),
        ));
    }
    if task.assigned_executor_widget_id.clone().unwrap_or_default() != settings.executor_widget_id {
        return Some(blocker(
            "executor_widget_mismatch",
            "Durable task executor assignment no longer matches the workflow settingsHash.",
            Some("runSettings.executorWidgetId"),
        ));
    }
    None
}

fn run_settings_from_binding(binding: &Value) -> Option<CanonicalQueueWorkflowRunSettings> {
    let settings = binding.as_object()?.get("runSettings")?.as_object()?;
    let execution_target = execution_target_from_bound_run_settings(settings)?;
    let executor_widget_id = execution_target.direct_work_owner_widget_id().to_owned();
    Some(CanonicalQueueWorkflowRunSettings {
        execution_workspace: optional_string_field(settings.get("executionWorkspace"))?,
        codex_executable: optional_string_field(settings.get("codexExecutable"))?,
        sandbox: optional_string_field(settings.get("sandbox"))?,
        approval_policy: optional_string_field(settings.get("approvalPolicy"))?,
        execution_policy: optional_string_field(settings.get("executionPolicy"))?,
        execution_target,
        executor_widget_id,
    })
}

fn execution_target_from_bound_run_settings(
    settings: &Map<String, Value>,
) -> Option<CanonicalQueueWorkflowExecutionTarget> {
    let target = settings.get("executionTarget").and_then(Value::as_object);
    if let Some(target) = target {
        let kind = optional_string_field(target.get("kind"))?;
        let provider_id = optional_string_field(target.get("providerId"))?;
        if provider_id != "codex" {
            return None;
        }
        return match kind.as_str() {
            "queue_local" => Some(CanonicalQueueWorkflowExecutionTarget {
                kind: CanonicalQueueWorkflowExecutionTargetKind::QueueLocal,
                provider_id,
                queue_owner_widget_instance_id: optional_string_field(
                    target.get("queueOwnerWidgetInstanceId"),
                ),
                executor_widget_id: None,
            }),
            "agent_executor" => Some(CanonicalQueueWorkflowExecutionTarget {
                kind: CanonicalQueueWorkflowExecutionTargetKind::AgentExecutor,
                provider_id,
                queue_owner_widget_instance_id: None,
                executor_widget_id: Some(optional_string_field(target.get("executorWidgetId"))?),
            }),
            _ => None,
        };
    }

    Some(CanonicalQueueWorkflowExecutionTarget {
        kind: CanonicalQueueWorkflowExecutionTargetKind::AgentExecutor,
        provider_id: "codex".to_owned(),
        queue_owner_widget_instance_id: None,
        executor_widget_id: Some(optional_string_field(settings.get("executorWidgetId"))?),
    })
}

fn same_slot_action_conflict(
    store: &hobit_storage_sqlite::SqliteStore,
    workspace_id: &str,
    workflow_run_id: &str,
    action_type: &str,
    slot: &str,
    hash_field: &str,
    expected_hash: &str,
    conflict_code: &str,
    conflict_message: &str,
) -> Result<Option<QueueWorkflowConflict>, hobit_storage_sqlite::StorageError> {
    for action in store.list_agent_queue_workflow_actions(workspace_id, workflow_run_id)? {
        if action.action_type != action_type {
            continue;
        }
        let Some(target_refs) = parse_json_object(action.target_refs_json.as_deref()) else {
            continue;
        };
        let action_slot = target_refs.get("slot").and_then(Value::as_str);
        let action_hash = target_refs.get(hash_field).and_then(Value::as_str);
        if action_slot == Some(slot) && action_hash.is_some_and(|hash| hash != expected_hash) {
            return Ok(Some(QueueWorkflowConflict {
                conflict_code: conflict_code.to_owned(),
                conflict_message: conflict_message.to_owned(),
                existing_workflow_run_id: Some(workflow_run_id.to_owned()),
                existing_request_hash: action.target_refs_json,
                requested_request_hash: Some(expected_hash.to_owned()),
            }));
        }
    }
    Ok(None)
}

fn workflow_action_matches(
    action: &hobit_storage_sqlite::AgentQueueWorkflowActionRow,
    workspace_id: &str,
    workflow_run_id: &str,
    step_id: &str,
    action_type: &str,
    target_refs_json: &str,
    result_refs_json: &str,
) -> bool {
    workflow_action_target_matches(
        action,
        workspace_id,
        workflow_run_id,
        step_id,
        action_type,
        target_refs_json,
    ) && action.result_refs_json.as_deref() == Some(result_refs_json)
}

fn workflow_action_target_matches(
    action: &hobit_storage_sqlite::AgentQueueWorkflowActionRow,
    workspace_id: &str,
    workflow_run_id: &str,
    step_id: &str,
    action_type: &str,
    target_refs_json: &str,
) -> bool {
    action.workspace_id == workspace_id
        && action.workflow_run_id == workflow_run_id
        && action.step_id == step_id
        && action.action_type == action_type
        && action.target_refs_json.as_deref() == Some(target_refs_json)
}

fn run_settings_target_refs_json(
    request: &NormalizedApplyRunSettingsRequest,
    task_id: &str,
) -> String {
    let execution_target = &request.run_settings.execution_target;
    canonical_json_string(&json!({
        "executionTargetHash": workflow_execution_target_hash(execution_target),
        "executionTargetKind": execution_target.kind.as_str(),
        "providerId": &execution_target.provider_id,
        "queueOwnerWidgetInstanceId": &execution_target.queue_owner_widget_instance_id,
        "settingsHash": request.settings_hash,
        "slot": request.slot,
        "taskId": task_id,
        "workflowRunId": request.workflow_run_id,
    }))
}

fn run_settings_result_refs_json(
    request: &NormalizedApplyRunSettingsRequest,
    task_id: &str,
) -> String {
    let execution_target = &request.run_settings.execution_target;
    canonical_json_string(&json!({
        "executionTargetHash": workflow_execution_target_hash(execution_target),
        "executionTargetKind": execution_target.kind.as_str(),
        "executorWidgetId": request.run_settings.executor_widget_id,
        "providerId": &execution_target.provider_id,
        "queueOwnerWidgetInstanceId": &execution_target.queue_owner_widget_instance_id,
        "result": "applied",
        "settingsHash": request.settings_hash,
        "taskId": task_id,
    }))
}

fn promote_target_refs_json(request: &NormalizedPromoteTaskSlotRequest, task_id: &str) -> String {
    canonical_json_string(&json!({
        "settingsHash": request.settings_hash,
        "slot": request.slot,
        "taskId": task_id,
        "taskSpecHash": request.task_spec_hash,
        "workflowRunId": request.workflow_run_id,
    }))
}

fn promote_result_refs_json(task_id: &str, task_state: &str, status: &str) -> String {
    canonical_json_string(&json!({
        "result": status,
        "taskId": task_id,
        "taskState": task_state,
    }))
}

fn apply_run_settings_to_binding(
    binding: &mut Value,
    request: &NormalizedApplyRunSettingsRequest,
    summary: &QueueWorkflowRunSettingsBindingSummary,
) {
    let object = ensure_object(binding);
    object.insert(
        "settingsHash".to_owned(),
        Value::String(summary.settings_hash.clone()),
    );
    object.insert(
        "executionTargetKind".to_owned(),
        Value::String(summary.execution_target_kind.clone()),
    );
    object.insert(
        "providerId".to_owned(),
        Value::String(summary.provider_id.clone()),
    );
    object.insert(
        "queueOwnerWidgetInstanceId".to_owned(),
        summary
            .queue_owner_widget_instance_id
            .clone()
            .map(Value::String)
            .unwrap_or(Value::Null),
    );
    object.insert(
        "executorWidgetId".to_owned(),
        Value::String(summary.executor_widget_id.clone()),
    );
    object.insert(
        "executionTargetHash".to_owned(),
        Value::String(summary.execution_target_hash.clone()),
    );
    object.insert(
        "runSettings".to_owned(),
        json!({
            "approvalPolicy": request.run_settings.approval_policy,
            "codexExecutable": request.run_settings.codex_executable,
            "executionPolicy": request.run_settings.execution_policy,
            "executionWorkspace": request.run_settings.execution_workspace,
            "executionTarget": execution_target_json(&request.run_settings.execution_target),
            "executorWidgetId": request.run_settings.executor_widget_id,
            "sandbox": request.run_settings.sandbox,
        }),
    );
    if let Some(action_id) = &summary.update_run_settings_action_id {
        object.insert(
            "updateRunSettingsActionId".to_owned(),
            Value::String(action_id.clone()),
        );
    }
    object.insert(
        "updateRunSettingsActionIdempotencyKey".to_owned(),
        Value::String(summary.update_run_settings_action_idempotency_key.clone()),
    );
    if let Some(actor_id) = &request.actor_id {
        object.insert(
            "settingsAppliedByActorId".to_owned(),
            Value::String(actor_id.clone()),
        );
    }
}

fn execution_target_json(target: &CanonicalQueueWorkflowExecutionTarget) -> Value {
    match target.kind {
        CanonicalQueueWorkflowExecutionTargetKind::QueueLocal => json!({
            "kind": target.kind.as_str(),
            "providerId": &target.provider_id,
            "queueOwnerWidgetInstanceId": &target.queue_owner_widget_instance_id,
        }),
        CanonicalQueueWorkflowExecutionTargetKind::AgentExecutor => json!({
            "kind": target.kind.as_str(),
            "providerId": &target.provider_id,
            "executorWidgetId": &target.executor_widget_id,
        }),
    }
}

fn apply_promote_to_binding(
    binding: &mut Value,
    request: &NormalizedPromoteTaskSlotRequest,
    summary: &QueueWorkflowPromoteTaskSlotBindingSummary,
    promote_status: &str,
    promoted_at: &str,
) {
    let object = ensure_object(binding);
    object.insert("promoted".to_owned(), Value::Bool(true));
    object.insert(
        "promoteStatus".to_owned(),
        Value::String(promote_status.to_owned()),
    );
    object.insert(
        "promotedTaskStatus".to_owned(),
        Value::String(summary.task_status.clone()),
    );
    object.insert(
        "promotedAt".to_owned(),
        Value::String(promoted_at.to_owned()),
    );
    if let Some(action_id) = &summary.promote_action_id {
        object.insert(
            "promoteActionId".to_owned(),
            Value::String(action_id.clone()),
        );
    }
    object.insert(
        "promoteActionIdempotencyKey".to_owned(),
        Value::String(summary.promote_action_idempotency_key.clone()),
    );
    if let Some(actor_id) = &request.actor_id {
        object.insert(
            "promotedByActorId".to_owned(),
            Value::String(actor_id.clone()),
        );
    }
}

fn ensure_object(value: &mut Value) -> &mut Map<String, Value> {
    if !value.is_object() {
        *value = Value::Object(Map::new());
    }
    value.as_object_mut().expect("object")
}

fn parse_slot_bindings(
    slot_bindings_json: Option<&str>,
) -> Result<Map<String, Value>, QueueWorkflowCommandBlocker> {
    let Some(json) = slot_bindings_json else {
        return Ok(Map::new());
    };
    if json.trim().is_empty() {
        return Ok(Map::new());
    }
    let value = serde_json::from_str::<Value>(json).map_err(|_| {
        blocker(
            "invalid_slot_bindings_json",
            "Queue workflow slotBindings JSON could not be parsed.",
            Some("slotBindings"),
        )
    })?;
    match value {
        Value::Null => Ok(Map::new()),
        Value::Object(object) => Ok(object),
        _ => Err(blocker(
            "invalid_slot_bindings_json",
            "Queue workflow slotBindings must be a JSON object.",
            Some("slotBindings"),
        )),
    }
}

fn parse_json_object(raw: Option<&str>) -> Option<Map<String, Value>> {
    let raw = raw?;
    serde_json::from_str::<Value>(raw)
        .ok()?
        .as_object()
        .cloned()
}

fn string_field<'a>(value: &'a Value, field: &str) -> Option<&'a str> {
    value
        .as_object()
        .and_then(|object| object.get(field))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

fn optional_string_field(value: Option<&Value>) -> Option<String> {
    value
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}

fn normalize_slot(slot: String, field: &str) -> Result<String, QueueWorkflowCommandBlocker> {
    let slot = required_owned(slot, field)?;
    if slot.chars().count() > MAX_WORKFLOW_TASK_SLOT_CHARS {
        return Err(blocker(
            "workflow_task_slot_too_large",
            "Queue workflow task slot exceeds the configured character limit.",
            Some(field),
        ));
    }
    if !valid_slot(&slot) {
        return Err(blocker(
            "invalid_task_slot",
            "Queue workflow task slot must start with a letter and contain only letters, numbers, underscore, or hyphen.",
            Some(field),
        ));
    }
    Ok(slot)
}

fn valid_slot(slot: &str) -> bool {
    let mut chars = slot.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    if !first.is_ascii_alphabetic() {
        return false;
    }
    chars.all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
}

fn required_owned(value: String, field: &str) -> Result<String, QueueWorkflowCommandBlocker> {
    let value = value.trim().to_owned();
    if value.is_empty() {
        return Err(blocker(
            &format!("missing_{field}"),
            "Queue workflow setup request is missing a required field.",
            Some(field),
        ));
    }
    Ok(value)
}

fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

fn terminal_workflow_status(status: &str) -> bool {
    matches!(status, "completed" | "failed" | "cancelled")
}

fn settings_conflict(
    request: &NormalizedApplyRunSettingsRequest,
    conflict_code: &str,
    conflict_message: &str,
    existing_hash: Option<&str>,
) -> QueueWorkflowConflict {
    QueueWorkflowConflict {
        conflict_code: conflict_code.to_owned(),
        conflict_message: conflict_message.to_owned(),
        existing_workflow_run_id: Some(request.workflow_run_id.clone()),
        existing_request_hash: existing_hash.map(str::to_owned),
        requested_request_hash: Some(request.settings_hash.clone()),
    }
}

fn promote_conflict(
    request: &NormalizedPromoteTaskSlotRequest,
    conflict_code: &str,
    conflict_message: &str,
    existing_hash: Option<&str>,
    requested_hash: Option<&str>,
) -> QueueWorkflowConflict {
    QueueWorkflowConflict {
        conflict_code: conflict_code.to_owned(),
        conflict_message: conflict_message.to_owned(),
        existing_workflow_run_id: Some(request.workflow_run_id.clone()),
        existing_request_hash: existing_hash.map(str::to_owned),
        requested_request_hash: requested_hash
            .map(str::to_owned)
            .or_else(|| Some(request.settings_hash.clone())),
    }
}

fn blocker(
    code: &str,
    message: &str,
    missing_required_field: Option<&str>,
) -> QueueWorkflowCommandBlocker {
    QueueWorkflowCommandBlocker {
        blocker_code: code.to_owned(),
        blocker_message: message.to_owned(),
        missing_required_field: missing_required_field.map(str::to_owned),
    }
}

fn apply_result(
    status: QueueWorkflowApplyRunSettingsStatus,
    workflow_run: Option<QueueWorkflowRun>,
    task: Option<AgentQueueTaskSummary>,
    action: Option<QueueWorkflowAction>,
    binding: Option<QueueWorkflowRunSettingsBindingSummary>,
    blocker: Option<QueueWorkflowCommandBlocker>,
    conflict: Option<QueueWorkflowConflict>,
) -> QueueWorkflowApplyRunSettingsResult {
    QueueWorkflowApplyRunSettingsResult {
        status,
        workflow_run,
        task,
        action,
        binding,
        blocker,
        conflict,
    }
}

fn promote_result(
    status: QueueWorkflowPromoteTaskSlotStatus,
    workflow_run: Option<QueueWorkflowRun>,
    task: Option<AgentQueueTaskSummary>,
    action: Option<QueueWorkflowAction>,
    binding: Option<QueueWorkflowPromoteTaskSlotBindingSummary>,
    blocker: Option<QueueWorkflowCommandBlocker>,
    conflict: Option<QueueWorkflowConflict>,
) -> QueueWorkflowPromoteTaskSlotResult {
    QueueWorkflowPromoteTaskSlotResult {
        status,
        workflow_run,
        task,
        action,
        binding,
        blocker,
        conflict,
    }
}

pub(super) fn durable_settings_hash_for_task_with_target(
    task: &AgentQueueTaskRow,
    target: &CanonicalQueueWorkflowExecutionTarget,
) -> Option<String> {
    Some(
        QueueWorkerStartSettingsSnapshot {
            execution_workspace: task.execution_workspace.clone()?,
            codex_executable: task.codex_executable.clone()?,
            sandbox: task.sandbox.clone()?,
            approval_policy: task.approval_policy.clone()?,
            execution_policy: task.execution_policy.clone(),
            execution_target_kind: target.kind.as_str().to_owned(),
            provider_id: target.provider_id.clone(),
            queue_owner_widget_instance_id: target.queue_owner_widget_instance_id.clone(),
            executor_widget_id: target
                .target_executor_widget_id_for_hash()
                .unwrap_or_default(),
        }
        .stable_hash(),
    )
}
