use std::collections::BTreeSet;

use hobit_storage_sqlite::{
    AgentQueueTaskRow, AgentQueueWorkflowActionRow, AgentQueueWorkflowRunReportUpdate,
    NewAgentQueueTask, NewAgentQueueWorkflowAction,
};
use serde_json::{json, Map, Value};

use crate::WorkspaceServiceError;

use super::{
    agent_queue_lifecycle::{
        AGENT_QUEUE_TASK_EXECUTION_POLICY_MANUAL, AGENT_QUEUE_TASK_STATUS_DRAFT,
    },
    agent_queue_task_dependencies::{dependencies_json, validate_create_dependencies},
    agent_queue_tasks::map_storage_agent_queue_task_error,
    agent_queue_workflow::{canonical_json_string, stable_fnv1a64_hash},
    mapping::agent_queue_task_summary,
    placeholder_id, placeholder_timestamp, AgentQueueTaskSummary, QueueWorkflowAction,
    QueueWorkflowActionStatus, QueueWorkflowCommandBlocker, QueueWorkflowConflict,
    QueueWorkflowRun, WorkspaceService, MAX_WORKFLOW_SLOT_BINDINGS_JSON_BYTES,
};

const CREATE_TASK_ACTION_TYPE: &str = "create_task";
const CREATE_TASK_STEP_ID: &str = "create_task";
const MAX_WORKFLOW_TASK_TITLE_CHARS: usize = 160;
const MAX_WORKFLOW_TASK_DESCRIPTION_CHARS: usize = 4_096;
const MAX_WORKFLOW_TASK_PROMPT_CHARS: usize = 16_384;
const MAX_WORKFLOW_TASK_SLOT_CHARS: usize = 96;
const MAX_WORKFLOW_TASK_DEPENDENCY_SLOTS: usize = 64;
const DEFAULT_WORKFLOW_TASK_PRIORITY: i64 = 0;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowTaskSpec {
    pub title: String,
    pub prompt: String,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<i64>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowMaterializeTaskSlotRequest {
    pub workspace_id: String,
    pub workflow_run_id: String,
    pub slot: String,
    pub task_spec: QueueWorkflowTaskSpec,
    pub task_spec_hash: Option<String>,
    pub depends_on_slots: Vec<String>,
    pub actor_id: Option<String>,
    pub action_idempotency_key: Option<String>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum QueueWorkflowMaterializeTaskSlotStatus {
    Created,
    Reused,
    Conflict,
    Blocked,
    NotFound,
    InvalidInput,
}

impl QueueWorkflowMaterializeTaskSlotStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Created => "created",
            Self::Reused => "reused",
            Self::Conflict => "conflict",
            Self::Blocked => "blocked",
            Self::NotFound => "not_found",
            Self::InvalidInput => "invalid_input",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowTaskSlotBindingSummary {
    pub slot: String,
    pub task_id: String,
    pub task_spec_hash: String,
    pub dependency_spec_hash: String,
    pub dependency_edge_hash: String,
    pub depends_on_slots: Vec<String>,
    pub dependency_task_ids: Vec<String>,
    pub create_task_action_id: Option<String>,
    pub create_task_action_idempotency_key: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowMaterializeTaskSlotResult {
    pub status: QueueWorkflowMaterializeTaskSlotStatus,
    pub workflow_run: Option<QueueWorkflowRun>,
    pub task: Option<AgentQueueTaskSummary>,
    pub action: Option<QueueWorkflowAction>,
    pub binding: Option<QueueWorkflowTaskSlotBindingSummary>,
    pub blocker: Option<QueueWorkflowCommandBlocker>,
    pub conflict: Option<QueueWorkflowConflict>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) struct CanonicalQueueWorkflowTaskSpec {
    pub title: String,
    pub prompt: String,
    pub description: String,
    pub status: String,
    pub priority: i64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedMaterializeTaskSlotRequest {
    workspace_id: String,
    workflow_run_id: String,
    slot: String,
    task_spec: CanonicalQueueWorkflowTaskSpec,
    task_spec_hash: String,
    dependency_spec_hash: String,
    depends_on_slots: Vec<String>,
    actor_id: Option<String>,
    action_idempotency_key: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct ResolvedDependencySlots {
    dependency_task_ids: Vec<String>,
    dependency_edge_hash: String,
}

impl WorkspaceService {
    pub fn materialize_agent_queue_workflow_task_slot(
        &self,
        request: QueueWorkflowMaterializeTaskSlotRequest,
    ) -> Result<QueueWorkflowMaterializeTaskSlotResult, WorkspaceServiceError> {
        let request = match normalize_materialize_task_slot_request(request) {
            Ok(request) => request,
            Err(blocker) => {
                return Ok(materialize_result(
                    QueueWorkflowMaterializeTaskSlotStatus::InvalidInput,
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
        let created_at = placeholder_timestamp();

        let result = self
            .store
            .with_immediate_transaction(|store| {
                let Some(run) = store.get_agent_queue_workflow_run(
                    &request.workspace_id,
                    &request.workflow_run_id,
                )?
                else {
                    return Ok(materialize_result(
                        QueueWorkflowMaterializeTaskSlotStatus::NotFound,
                        None,
                        None,
                        None,
                        None,
                        Some(blocker(
                            "workflow_run_not_found",
                            "Queue workflow run was not found for task slot materialization.",
                            Some("workflowRunId"),
                        )),
                        None,
                    ));
                };

                if terminal_workflow_status(&run.status) {
                    return Ok(materialize_result(
                        QueueWorkflowMaterializeTaskSlotStatus::Blocked,
                        Some(QueueWorkflowRun::from(run)),
                        None,
                        None,
                        None,
                        Some(blocker(
                            "workflow_run_terminal",
                            "Queue workflow task slots cannot be materialized after the workflow is terminal.",
                            None,
                        )),
                        None,
                    ));
                }

                let mut slot_bindings = match parse_slot_bindings(run.slot_bindings_json.as_deref())
                {
                    Ok(bindings) => bindings,
                    Err(blocker) => {
                        return Ok(materialize_result(
                            QueueWorkflowMaterializeTaskSlotStatus::InvalidInput,
                            Some(QueueWorkflowRun::from(run)),
                            None,
                            None,
                            None,
                            Some(blocker),
                            None,
                        ));
                    }
                };

                if let Some(existing_binding) = slot_bindings.get(&request.slot) {
                    if let Some(existing_hash) =
                        string_field(existing_binding, "taskSpecHash")
                    {
                        if existing_hash != request.task_spec_hash {
                            return Ok(materialize_result(
                                QueueWorkflowMaterializeTaskSlotStatus::Conflict,
                                Some(QueueWorkflowRun::from(run)),
                                None,
                                None,
                                None,
                                None,
                                Some(task_spec_conflict(&request, Some(existing_hash))),
                            ));
                        }
                        if string_field(existing_binding, "taskId").is_none() {
                            return Ok(materialize_result(
                                QueueWorkflowMaterializeTaskSlotStatus::Conflict,
                                Some(QueueWorkflowRun::from(run)),
                                None,
                                None,
                                None,
                                None,
                                Some(QueueWorkflowConflict {
                                    conflict_code: "slot_binding_missing_task_id".to_owned(),
                                    conflict_message:
                                        "Existing Queue workflow slot binding is missing taskId and cannot be reused safely."
                                            .to_owned(),
                                    existing_workflow_run_id: Some(request.workflow_run_id.clone()),
                                    existing_request_hash: Some(existing_hash.to_owned()),
                                    requested_request_hash: Some(request.task_spec_hash.clone()),
                                }),
                            ));
                        }
                    } else {
                        return Ok(materialize_result(
                            QueueWorkflowMaterializeTaskSlotStatus::Conflict,
                            Some(QueueWorkflowRun::from(run)),
                            None,
                            None,
                            None,
                            None,
                            Some(QueueWorkflowConflict {
                                conflict_code: "slot_binding_missing_task_spec_hash".to_owned(),
                                conflict_message:
                                    "Existing Queue workflow slot binding does not include taskSpecHash and cannot be reused safely."
                                        .to_owned(),
                                existing_workflow_run_id: Some(request.workflow_run_id.clone()),
                                existing_request_hash: None,
                                requested_request_hash: Some(request.task_spec_hash.clone()),
                            }),
                        ));
                    }
                }

                let resolved_dependencies = match resolve_dependency_slots(
                    store,
                    &request,
                    &slot_bindings,
                ) {
                    Ok(resolved) => resolved,
                    Err(ResolveDependencySlotsError::Blocker(blocker)) => {
                        return Ok(materialize_result(
                            QueueWorkflowMaterializeTaskSlotStatus::Blocked,
                            Some(QueueWorkflowRun::from(run)),
                            None,
                            None,
                            None,
                            Some(blocker),
                            None,
                        ));
                    }
                    Err(ResolveDependencySlotsError::Storage(error)) => return Err(error),
                };

                let existing_bound_task_id = slot_bindings
                    .get(&request.slot)
                    .and_then(|binding| string_field(binding, "taskId").map(str::to_owned));
                let task_id = existing_bound_task_id.unwrap_or_else(|| {
                    deterministic_workflow_task_id(
                        &request.workflow_run_id,
                        &request.slot,
                        &request.task_spec_hash,
                    )
                });

                let target_refs_json = materialize_target_refs_json(&request);
                let result_refs_json =
                    materialize_result_refs_json(&task_id, &resolved_dependencies, "completed");

                let existing_action = store.get_agent_queue_workflow_action_by_idempotency_key(
                    &request.workflow_run_id,
                    &request.action_idempotency_key,
                )?;
                if let Some(existing_action) = existing_action.as_ref() {
                    if !workflow_action_matches_refs(
                        existing_action,
                        &request,
                        &target_refs_json,
                        &result_refs_json,
                    ) {
                        return Ok(materialize_result(
                            QueueWorkflowMaterializeTaskSlotStatus::Conflict,
                            Some(QueueWorkflowRun::from(run)),
                            None,
                            None,
                            None,
                            None,
                            Some(QueueWorkflowConflict {
                                conflict_code: "create_task_action_ref_conflict".to_owned(),
                                conflict_message:
                                    "A Queue workflow create_task action already exists for this idempotency key with different typed refs."
                                        .to_owned(),
                                existing_workflow_run_id: Some(request.workflow_run_id.clone()),
                                existing_request_hash: existing_action.target_refs_json.clone(),
                                requested_request_hash: Some(target_refs_json.clone()),
                            }),
                        ));
                    }
                    if existing_action.status != QueueWorkflowActionStatus::Completed.as_str() {
                        return Ok(materialize_result(
                            QueueWorkflowMaterializeTaskSlotStatus::Blocked,
                            Some(QueueWorkflowRun::from(run)),
                            None,
                            Some(QueueWorkflowAction::from(existing_action.clone())),
                            None,
                            Some(blocker(
                                "create_task_action_not_completed",
                                "Existing Queue workflow create_task action is not completed and will not be retried blindly.",
                                None,
                            )),
                            None,
                        ));
                    }
                }

                let create_task_action_id = existing_action
                    .as_ref()
                    .map(|action| action.action_id.clone())
                    .unwrap_or_else(|| action_id.clone());
                let binding = QueueWorkflowTaskSlotBindingSummary {
                    slot: request.slot.clone(),
                    task_id: task_id.clone(),
                    task_spec_hash: request.task_spec_hash.clone(),
                    dependency_spec_hash: request.dependency_spec_hash.clone(),
                    dependency_edge_hash: resolved_dependencies.dependency_edge_hash.clone(),
                    depends_on_slots: request.depends_on_slots.clone(),
                    dependency_task_ids: resolved_dependencies.dependency_task_ids.clone(),
                    create_task_action_id: Some(create_task_action_id),
                    create_task_action_idempotency_key: request.action_idempotency_key.clone(),
                };
                slot_bindings.insert(request.slot.clone(), binding_value(&binding, &request));
                let slot_bindings_json = canonical_json_string(&Value::Object(slot_bindings));
                if slot_bindings_json.len() > MAX_WORKFLOW_SLOT_BINDINGS_JSON_BYTES {
                    return Ok(materialize_result(
                        QueueWorkflowMaterializeTaskSlotStatus::InvalidInput,
                        Some(QueueWorkflowRun::from(run)),
                        None,
                        None,
                        None,
                        Some(blocker(
                            "slot_bindings_too_large",
                            "Queue workflow slot bindings exceed the configured byte limit.",
                            Some("slotBindings"),
                        )),
                        None,
                    ));
                }

                let depends_on_json = dependencies_json(&resolved_dependencies.dependency_task_ids)?;
                validate_create_dependencies(
                    store,
                    &request.workspace_id,
                    &resolved_dependencies.dependency_task_ids,
                )?;

                let (task, was_created) = match store.get_agent_queue_task_by_id(&task_id)? {
                    Some(existing) => {
                        if existing.workspace_id != request.workspace_id {
                            return Ok(materialize_result(
                                QueueWorkflowMaterializeTaskSlotStatus::Conflict,
                                Some(QueueWorkflowRun::from(run)),
                                None,
                                None,
                                None,
                                None,
                                Some(QueueWorkflowConflict {
                                    conflict_code: "workflow_task_id_workspace_conflict"
                                        .to_owned(),
                                    conflict_message:
                                        "Deterministic Queue workflow task id already belongs to a different workspace."
                                            .to_owned(),
                                    existing_workflow_run_id: Some(request.workflow_run_id.clone()),
                                    existing_request_hash: Some(existing.workspace_id.clone()),
                                    requested_request_hash: Some(request.workspace_id.clone()),
                                }),
                            ));
                        }
                        if let Some(blocker) = validate_existing_materialized_task(
                            &existing,
                            &request,
                            &depends_on_json,
                        ) {
                            return Ok(materialize_result(
                                QueueWorkflowMaterializeTaskSlotStatus::Blocked,
                                Some(QueueWorkflowRun::from(run)),
                                Some(agent_queue_task_summary(existing)),
                                None,
                                None,
                                Some(blocker),
                                None,
                            ));
                        }
                        (existing, false)
                    }
                    None => {
                        let task = store.create_agent_queue_task(NewAgentQueueTask {
                            queue_item_id: &task_id,
                            workspace_id: &request.workspace_id,
                            title: &request.task_spec.title,
                            description: &request.task_spec.description,
                            prompt: &request.task_spec.prompt,
                            status: &request.task_spec.status,
                            priority: request.task_spec.priority,
                            depends_on: Some(&depends_on_json),
                            execution_policy: Some(AGENT_QUEUE_TASK_EXECUTION_POLICY_MANUAL),
                            execution_workspace: None,
                            codex_executable: None,
                            sandbox: None,
                            approval_policy: None,
                            context_json: None,
                            created_at: Some(&created_at),
                            updated_at: Some(&created_at),
                        })?;
                        (task, true)
                    }
                };

                let action = store.insert_agent_queue_workflow_action(NewAgentQueueWorkflowAction {
                    action_id: &action_id,
                    workflow_run_id: &request.workflow_run_id,
                    workspace_id: &request.workspace_id,
                    step_id: CREATE_TASK_STEP_ID,
                    action_type: CREATE_TASK_ACTION_TYPE,
                    idempotency_key: &request.action_idempotency_key,
                    status: QueueWorkflowActionStatus::Completed.as_str(),
                    target_refs_json: Some(&target_refs_json),
                    result_refs_json: Some(&result_refs_json),
                    blocker_code: None,
                    blocker_message: None,
                    attempt_count: 1,
                    started_at: Some(&created_at),
                    completed_at: Some(&created_at),
                    created_at: Some(&created_at),
                    updated_at: Some(&created_at),
                })?;

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
                            updated_at: Some(&created_at),
                            completed_at: None,
                        },
                    )?
                    .ok_or(hobit_storage_sqlite::StorageError::QueryReturnedNoRows)?;
                store.touch_workspace(&request.workspace_id)?;

                Ok(materialize_result(
                    if was_created {
                        QueueWorkflowMaterializeTaskSlotStatus::Created
                    } else {
                        QueueWorkflowMaterializeTaskSlotStatus::Reused
                    },
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

pub(super) fn normalize_queue_workflow_task_spec_for_hash(
    task_spec: QueueWorkflowTaskSpec,
    depends_on_slots: Vec<String>,
) -> Result<(CanonicalQueueWorkflowTaskSpec, Vec<String>, String, String), String> {
    let task_spec = normalize_task_spec(task_spec).map_err(|blocker| blocker.blocker_message)?;
    let depends_on_slots = normalize_dependency_slots(depends_on_slots, None)
        .map_err(|blocker| blocker.blocker_message)?;
    let task_spec_hash = workflow_task_spec_hash(&task_spec, &depends_on_slots);
    let dependency_spec_hash = workflow_dependency_spec_hash(&depends_on_slots);
    Ok((
        task_spec,
        depends_on_slots,
        task_spec_hash,
        dependency_spec_hash,
    ))
}

pub(super) fn workflow_dependency_edge_hash(dependency_task_ids: &[String]) -> String {
    let mut sorted = dependency_task_ids.to_vec();
    sorted.sort();
    let value = json!({ "dependencyTaskIds": sorted });
    stable_fnv1a64_hash(
        "queue-dependency-edge-fnv1a64",
        &canonical_json_string(&value),
    )
}

fn normalize_materialize_task_slot_request(
    request: QueueWorkflowMaterializeTaskSlotRequest,
) -> Result<NormalizedMaterializeTaskSlotRequest, QueueWorkflowCommandBlocker> {
    let workspace_id = required_owned(request.workspace_id, "workspaceId")?;
    let workflow_run_id = required_owned(request.workflow_run_id, "workflowRunId")?;
    let slot = normalize_slot(request.slot, "slot")?;
    let task_spec = normalize_task_spec(request.task_spec)?;
    let depends_on_slots = normalize_dependency_slots(request.depends_on_slots, Some(&slot))?;
    let computed_task_spec_hash = workflow_task_spec_hash(&task_spec, &depends_on_slots);
    let dependency_spec_hash = workflow_dependency_spec_hash(&depends_on_slots);
    if let Some(provided_hash) = normalize_optional_string(request.task_spec_hash) {
        if provided_hash != computed_task_spec_hash {
            return Err(blocker(
                "task_spec_hash_mismatch",
                "Provided taskSpecHash does not match the canonical typed taskSpec.",
                Some("taskSpecHash"),
            ));
        }
    }
    let action_idempotency_key =
        format!("{workflow_run_id}:{CREATE_TASK_ACTION_TYPE}:{slot}:{computed_task_spec_hash}");
    if let Some(provided_key) = normalize_optional_string(request.action_idempotency_key) {
        if provided_key != action_idempotency_key {
            return Err(blocker(
                "invalid_action_idempotency_key",
                "Queue workflow task materialization idempotency key must be workflowRunId:create_task:slot:taskSpecHash.",
                Some("actionIdempotencyKey"),
            ));
        }
    }

    Ok(NormalizedMaterializeTaskSlotRequest {
        workspace_id,
        workflow_run_id,
        slot,
        task_spec,
        task_spec_hash: computed_task_spec_hash,
        dependency_spec_hash,
        depends_on_slots,
        actor_id: normalize_optional_string(request.actor_id),
        action_idempotency_key,
    })
}

fn normalize_task_spec(
    task_spec: QueueWorkflowTaskSpec,
) -> Result<CanonicalQueueWorkflowTaskSpec, QueueWorkflowCommandBlocker> {
    let title = required_bounded_string(
        task_spec.title,
        "taskSpec.title",
        MAX_WORKFLOW_TASK_TITLE_CHARS,
    )?;
    let prompt = required_bounded_string(
        task_spec.prompt,
        "taskSpec.prompt",
        MAX_WORKFLOW_TASK_PROMPT_CHARS,
    )?;
    let description = bounded_optional_string(
        task_spec.description,
        "taskSpec.description",
        MAX_WORKFLOW_TASK_DESCRIPTION_CHARS,
    )?
    .unwrap_or_default();
    let status = normalize_optional_string(task_spec.status)
        .unwrap_or_else(|| AGENT_QUEUE_TASK_STATUS_DRAFT.to_owned());
    if status != AGENT_QUEUE_TASK_STATUS_DRAFT {
        return Err(blocker(
            "unsupported_initial_task_status",
            "Queue workflow task slot materialization only creates draft Queue tasks in this phase.",
            Some("taskSpec.status"),
        ));
    }
    let priority = task_spec.priority.unwrap_or(DEFAULT_WORKFLOW_TASK_PRIORITY);
    if !(0..=5).contains(&priority) {
        return Err(blocker(
            "invalid_task_priority",
            "Queue workflow task priority must be between 0 and 5.",
            Some("taskSpec.priority"),
        ));
    }

    Ok(CanonicalQueueWorkflowTaskSpec {
        title,
        prompt,
        description,
        status,
        priority,
    })
}

fn workflow_task_spec_hash(
    task_spec: &CanonicalQueueWorkflowTaskSpec,
    depends_on_slots: &[String],
) -> String {
    let value = json!({
        "dependsOnSlots": depends_on_slots,
        "description": task_spec.description,
        "priority": task_spec.priority,
        "prompt": task_spec.prompt,
        "status": task_spec.status,
        "title": task_spec.title,
    });
    stable_fnv1a64_hash("queue-task-spec-fnv1a64", &canonical_json_string(&value))
}

fn workflow_dependency_spec_hash(depends_on_slots: &[String]) -> String {
    let value = json!({ "dependsOnSlots": depends_on_slots });
    stable_fnv1a64_hash(
        "queue-dependency-spec-fnv1a64",
        &canonical_json_string(&value),
    )
}

fn resolve_dependency_slots(
    store: &hobit_storage_sqlite::SqliteStore,
    request: &NormalizedMaterializeTaskSlotRequest,
    slot_bindings: &Map<String, Value>,
) -> Result<ResolvedDependencySlots, ResolveDependencySlotsError> {
    let mut task_ids = Vec::with_capacity(request.depends_on_slots.len());
    for dependency_slot in &request.depends_on_slots {
        let Some(binding) = slot_bindings.get(dependency_slot) else {
            return Err(ResolveDependencySlotsError::Blocker(blocker(
                "missing_upstream_slot_binding",
                "Upstream dependency slot must have a durable taskId before downstream task materialization.",
                Some("dependsOnSlots"),
            )));
        };
        let Some(task_id) = string_field(binding, "taskId") else {
            return Err(ResolveDependencySlotsError::Blocker(blocker(
                "missing_upstream_task_id",
                "Upstream dependency slot binding is missing taskId.",
                Some("slotBindings.taskId"),
            )));
        };
        match store.get_agent_queue_task(&request.workspace_id, task_id)? {
            Some(_) => task_ids.push(task_id.to_owned()),
            None => {
                return Err(ResolveDependencySlotsError::Blocker(blocker(
                    "upstream_task_missing",
                    "Upstream dependency task was not found in the workflow workspace.",
                    Some("dependsOnSlots"),
                )));
            }
        }
    }

    Ok(ResolvedDependencySlots {
        dependency_edge_hash: workflow_dependency_edge_hash(&task_ids),
        dependency_task_ids: task_ids,
    })
}

enum ResolveDependencySlotsError {
    Blocker(QueueWorkflowCommandBlocker),
    Storage(hobit_storage_sqlite::StorageError),
}

impl From<hobit_storage_sqlite::StorageError> for ResolveDependencySlotsError {
    fn from(error: hobit_storage_sqlite::StorageError) -> Self {
        Self::Storage(error)
    }
}

fn validate_existing_materialized_task(
    task: &AgentQueueTaskRow,
    request: &NormalizedMaterializeTaskSlotRequest,
    depends_on_json: &str,
) -> Option<QueueWorkflowCommandBlocker> {
    if task.title != request.task_spec.title
        || task.description != request.task_spec.description
        || task.prompt != request.task_spec.prompt
        || task.status != request.task_spec.status
        || task.priority != request.task_spec.priority
        || task.execution_policy != AGENT_QUEUE_TASK_EXECUTION_POLICY_MANUAL
        || task.execution_workspace.is_some()
        || task.codex_executable.is_some()
        || task.sandbox.is_some()
        || task.approval_policy.is_some()
    {
        return Some(blocker(
            "task_spec_state_mismatch",
            "Existing materialized Queue task no longer matches the workflow taskSpecHash.",
            None,
        ));
    }
    if task.depends_on != depends_on_json {
        return Some(blocker(
            "dependency_edge_missing",
            "Existing materialized Queue task dependency edge does not match explicit dependsOnSlots.",
            Some("dependsOnSlots"),
        ));
    }

    None
}

fn workflow_action_matches_refs(
    action: &AgentQueueWorkflowActionRow,
    request: &NormalizedMaterializeTaskSlotRequest,
    target_refs_json: &str,
    result_refs_json: &str,
) -> bool {
    action.workspace_id == request.workspace_id
        && action.workflow_run_id == request.workflow_run_id
        && action.step_id == CREATE_TASK_STEP_ID
        && action.action_type == CREATE_TASK_ACTION_TYPE
        && action.target_refs_json.as_deref() == Some(target_refs_json)
        && action.result_refs_json.as_deref() == Some(result_refs_json)
}

fn materialize_target_refs_json(request: &NormalizedMaterializeTaskSlotRequest) -> String {
    canonical_json_string(&json!({
        "dependencySpecHash": request.dependency_spec_hash,
        "dependsOnSlots": request.depends_on_slots,
        "slot": request.slot,
        "taskSpecHash": request.task_spec_hash,
        "workflowRunId": request.workflow_run_id,
    }))
}

fn materialize_result_refs_json(
    task_id: &str,
    resolved_dependencies: &ResolvedDependencySlots,
    status: &str,
) -> String {
    canonical_json_string(&json!({
        "dependencyEdgeHash": resolved_dependencies.dependency_edge_hash,
        "dependencyTaskIds": resolved_dependencies.dependency_task_ids,
        "status": status,
        "taskId": task_id,
    }))
}

fn binding_value(
    binding: &QueueWorkflowTaskSlotBindingSummary,
    request: &NormalizedMaterializeTaskSlotRequest,
) -> Value {
    let mut object = Map::new();
    object.insert("slot".to_owned(), Value::String(binding.slot.clone()));
    object.insert("taskId".to_owned(), Value::String(binding.task_id.clone()));
    object.insert(
        "taskSpecHash".to_owned(),
        Value::String(binding.task_spec_hash.clone()),
    );
    object.insert(
        "dependencySpecHash".to_owned(),
        Value::String(binding.dependency_spec_hash.clone()),
    );
    object.insert(
        "dependencyEdgeHash".to_owned(),
        Value::String(binding.dependency_edge_hash.clone()),
    );
    object.insert(
        "dependsOnSlots".to_owned(),
        Value::Array(
            binding
                .depends_on_slots
                .iter()
                .cloned()
                .map(Value::String)
                .collect(),
        ),
    );
    object.insert(
        "dependencyTaskIds".to_owned(),
        Value::Array(
            binding
                .dependency_task_ids
                .iter()
                .cloned()
                .map(Value::String)
                .collect(),
        ),
    );
    if let Some(action_id) = &binding.create_task_action_id {
        object.insert(
            "createTaskActionId".to_owned(),
            Value::String(action_id.clone()),
        );
    }
    object.insert(
        "createTaskActionIdempotencyKey".to_owned(),
        Value::String(binding.create_task_action_idempotency_key.clone()),
    );
    if let Some(actor_id) = &request.actor_id {
        object.insert(
            "createdByActorId".to_owned(),
            Value::String(actor_id.clone()),
        );
    }

    Value::Object(object)
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

fn string_field<'a>(value: &'a Value, field: &str) -> Option<&'a str> {
    value
        .as_object()
        .and_then(|object| object.get(field))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

fn deterministic_workflow_task_id(
    workflow_run_id: &str,
    slot: &str,
    task_spec_hash: &str,
) -> String {
    let value = json!({
        "slot": slot,
        "taskSpecHash": task_spec_hash,
        "workflowRunId": workflow_run_id,
    });
    let hash = stable_fnv1a64_hash("queue-task-id-fnv1a64", &canonical_json_string(&value));
    let suffix = hash.rsplit(':').next().unwrap_or("0000000000000000");
    format!("queue_task_wf_{suffix}")
}

fn normalize_dependency_slots(
    dependency_slots: Vec<String>,
    materialized_slot: Option<&str>,
) -> Result<Vec<String>, QueueWorkflowCommandBlocker> {
    if dependency_slots.len() > MAX_WORKFLOW_TASK_DEPENDENCY_SLOTS {
        return Err(blocker(
            "too_many_dependency_slots",
            "Queue workflow task materialization received too many dependsOnSlots entries.",
            Some("dependsOnSlots"),
        ));
    }

    let mut normalized = BTreeSet::new();
    for dependency_slot in dependency_slots {
        let dependency_slot = normalize_slot(dependency_slot, "dependsOnSlots")?;
        if materialized_slot.is_some_and(|slot| slot == dependency_slot) {
            return Err(blocker(
                "self_dependency_slot",
                "Queue workflow task slot cannot depend on itself.",
                Some("dependsOnSlots"),
            ));
        }
        if !normalized.insert(dependency_slot.clone()) {
            return Err(blocker(
                "duplicate_dependency_slot",
                "Queue workflow task dependsOnSlots must not include duplicates.",
                Some("dependsOnSlots"),
            ));
        }
    }

    Ok(normalized.into_iter().collect())
}

fn normalize_slot(slot: String, field: &str) -> Result<String, QueueWorkflowCommandBlocker> {
    let slot = required_bounded_string(slot, field, MAX_WORKFLOW_TASK_SLOT_CHARS)?;
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

fn required_bounded_string(
    value: String,
    field: &str,
    max_chars: usize,
) -> Result<String, QueueWorkflowCommandBlocker> {
    let value = required_owned(value, field)?;
    if value.chars().count() > max_chars {
        return Err(blocker(
            "workflow_task_spec_field_too_large",
            "Queue workflow taskSpec field exceeds the configured character limit.",
            Some(field),
        ));
    }
    Ok(value)
}

fn bounded_optional_string(
    value: Option<String>,
    field: &str,
    max_chars: usize,
) -> Result<Option<String>, QueueWorkflowCommandBlocker> {
    let Some(value) = normalize_optional_string(value) else {
        return Ok(None);
    };
    if value.chars().count() > max_chars {
        return Err(blocker(
            "workflow_task_spec_field_too_large",
            "Queue workflow taskSpec field exceeds the configured character limit.",
            Some(field),
        ));
    }
    Ok(Some(value))
}

fn required_owned(value: String, field: &str) -> Result<String, QueueWorkflowCommandBlocker> {
    let value = value.trim().to_owned();
    if value.is_empty() {
        return Err(blocker(
            &format!("missing_{field}"),
            "Queue workflow task materialization request is missing a required field.",
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

fn task_spec_conflict(
    request: &NormalizedMaterializeTaskSlotRequest,
    existing_hash: Option<&str>,
) -> QueueWorkflowConflict {
    QueueWorkflowConflict {
        conflict_code: "slot_task_spec_hash_conflict".to_owned(),
        conflict_message:
            "Queue workflow slot already has a task binding with a different taskSpecHash."
                .to_owned(),
        existing_workflow_run_id: Some(request.workflow_run_id.clone()),
        existing_request_hash: existing_hash.map(str::to_owned),
        requested_request_hash: Some(request.task_spec_hash.clone()),
    }
}

fn blocker(code: &str, message: &str, field: Option<&str>) -> QueueWorkflowCommandBlocker {
    QueueWorkflowCommandBlocker {
        blocker_code: code.to_owned(),
        blocker_message: message.to_owned(),
        missing_required_field: field.map(str::to_owned),
    }
}

fn materialize_result(
    status: QueueWorkflowMaterializeTaskSlotStatus,
    workflow_run: Option<QueueWorkflowRun>,
    task: Option<AgentQueueTaskSummary>,
    action: Option<QueueWorkflowAction>,
    binding: Option<QueueWorkflowTaskSlotBindingSummary>,
    blocker: Option<QueueWorkflowCommandBlocker>,
    conflict: Option<QueueWorkflowConflict>,
) -> QueueWorkflowMaterializeTaskSlotResult {
    QueueWorkflowMaterializeTaskSlotResult {
        status,
        workflow_run,
        task,
        action,
        binding,
        blocker,
        conflict,
    }
}
