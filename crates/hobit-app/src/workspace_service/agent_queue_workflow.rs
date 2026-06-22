use std::collections::BTreeMap;

use hobit_storage_sqlite::{
    AgentQueueWorkflowActionRow, AgentQueueWorkflowRunRow, AgentQueueWorkflowRunStatusUpdate,
    NewAgentQueueWorkflowRun, StorageError,
};
use serde_json::Value;

use crate::WorkspaceServiceError;

use super::{placeholder_id, placeholder_timestamp, WorkspaceService};

pub const MAX_WORKFLOW_INPUTS_JSON_BYTES: usize = 32_768;
pub const MAX_WORKFLOW_GRANT_SUMMARY_JSON_BYTES: usize = 8_192;
pub const MAX_WORKFLOW_VARIABLES_JSON_BYTES: usize = 16_384;
pub const MAX_WORKFLOW_SLOT_BINDINGS_JSON_BYTES: usize = 16_384;
pub const MAX_WORKFLOW_MUTATION_REFS_JSON_BYTES: usize = 16_384;
pub const MAX_WORKFLOW_IDEMPOTENCY_KEYS_JSON_BYTES: usize = 16_384;
pub const MAX_WORKFLOW_ACTION_LOG_SUMMARY_JSON_BYTES: usize = 16_384;

const QUEUE_WORKFLOW_SCHEMA_VERSION: i64 = 1;
const QUEUE_WORKFLOW_INITIAL_VERSION: i64 = 1;
const WORKFLOW_PHASE_INTAKE: &str = "intake";
const WORKFLOW_PHASE_CLOSED: &str = "closed";
const WORKFLOW_STEP_CREATED: &str = "created";
const WORKFLOW_STEP_CANCELLED: &str = "cancelled";
const WORKFLOW_CANCEL_REASON: &str = "cancelled_by_operator";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum QueueWorkflowRunStatus {
    Created,
    Running,
    Paused,
    Blocked,
    Completed,
    Failed,
    Cancelled,
}

impl QueueWorkflowRunStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Created => "created",
            Self::Running => "running",
            Self::Paused => "paused",
            Self::Blocked => "blocked",
            Self::Completed => "completed",
            Self::Failed => "failed",
            Self::Cancelled => "cancelled",
        }
    }

    fn from_str(value: &str) -> Option<Self> {
        match value {
            "created" => Some(Self::Created),
            "running" => Some(Self::Running),
            "paused" => Some(Self::Paused),
            "blocked" => Some(Self::Blocked),
            "completed" => Some(Self::Completed),
            "failed" => Some(Self::Failed),
            "cancelled" => Some(Self::Cancelled),
            _ => None,
        }
    }

    fn is_terminal(self) -> bool {
        matches!(self, Self::Completed | Self::Failed | Self::Cancelled)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum QueueWorkflowActionStatus {
    Created,
    Running,
    Completed,
    Blocked,
    Failed,
    Cancelled,
}

impl QueueWorkflowActionStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Created => "created",
            Self::Running => "running",
            Self::Completed => "completed",
            Self::Blocked => "blocked",
            Self::Failed => "failed",
            Self::Cancelled => "cancelled",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowRun {
    pub workflow_run_id: String,
    pub workspace_id: String,
    pub workflow_id: String,
    pub request_id: String,
    pub request_hash: String,
    pub status: String,
    pub phase: String,
    pub current_step: Option<String>,
    pub pause_reason: Option<String>,
    pub blocker_reason: Option<String>,
    pub actor_id: Option<String>,
    pub inputs_snapshot_json: Option<String>,
    pub grant_summary_json: Option<String>,
    pub variables_json: Option<String>,
    pub slot_bindings_json: Option<String>,
    pub mutation_refs_json: Option<String>,
    pub idempotency_keys_json: Option<String>,
    pub action_log_summary_json: Option<String>,
    pub version: i64,
    pub schema_version: i64,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowAction {
    pub action_id: String,
    pub workflow_run_id: String,
    pub workspace_id: String,
    pub step_id: String,
    pub action_type: String,
    pub idempotency_key: String,
    pub status: String,
    pub target_refs_json: Option<String>,
    pub result_refs_json: Option<String>,
    pub blocker_code: Option<String>,
    pub blocker_message: Option<String>,
    pub attempt_count: i64,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, PartialEq)]
pub struct QueueWorkflowStartRequest {
    pub workspace_id: String,
    pub workflow_id: String,
    pub request_id: String,
    pub phase: Option<String>,
    pub current_step: Option<String>,
    pub actor_id: Option<String>,
    pub inputs_snapshot: Option<Value>,
    pub grant_summary: Option<Value>,
    pub variables: Option<Value>,
    pub slot_bindings: Option<Value>,
    pub mutation_refs: Option<Value>,
    pub idempotency_keys: Option<Value>,
    pub action_log_summary: Option<Value>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowGetRequest {
    pub workspace_id: String,
    pub workflow_run_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowListRequest {
    pub workspace_id: String,
    pub status: Option<String>,
    pub workflow_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowCancelRequest {
    pub workspace_id: String,
    pub workflow_run_id: String,
    pub actor_id: Option<String>,
    pub reason: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowReport {
    pub workflow_run: QueueWorkflowRun,
    pub actions: Vec<QueueWorkflowAction>,
    pub resume_available: bool,
    pub resume_status: String,
    pub report_summary: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum QueueWorkflowStartStatus {
    Succeeded,
    AlreadyExists,
    Conflict,
    InvalidInput,
}

impl QueueWorkflowStartStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Succeeded => "succeeded",
            Self::AlreadyExists => "already_exists",
            Self::Conflict => "conflict",
            Self::InvalidInput => "invalid_input",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum QueueWorkflowCancelStatus {
    Cancelled,
    AlreadyCancelled,
    AlreadyTerminal,
    NotFound,
    InvalidInput,
}

impl QueueWorkflowCancelStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Cancelled => "cancelled",
            Self::AlreadyCancelled => "already_cancelled",
            Self::AlreadyTerminal => "already_terminal",
            Self::NotFound => "not_found",
            Self::InvalidInput => "invalid_input",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowCommandBlocker {
    pub blocker_code: String,
    pub blocker_message: String,
    pub missing_required_field: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowConflict {
    pub conflict_code: String,
    pub conflict_message: String,
    pub existing_workflow_run_id: Option<String>,
    pub existing_request_hash: Option<String>,
    pub requested_request_hash: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowStartResult {
    pub status: QueueWorkflowStartStatus,
    pub workflow_run: Option<QueueWorkflowRun>,
    pub conflict: Option<QueueWorkflowConflict>,
    pub blocker: Option<QueueWorkflowCommandBlocker>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowCancelResult {
    pub status: QueueWorkflowCancelStatus,
    pub workflow_run: Option<QueueWorkflowRun>,
    pub blocker: Option<QueueWorkflowCommandBlocker>,
}

impl WorkspaceService {
    pub fn start_queue_workflow(
        &self,
        request: QueueWorkflowStartRequest,
    ) -> Result<QueueWorkflowStartResult, WorkspaceServiceError> {
        let workspace_id = request.workspace_id.trim().to_owned();
        let workflow_id = request.workflow_id.trim().to_owned();
        let request_id = request.request_id.trim().to_owned();
        let actor_id = optional_trimmed_option(request.actor_id.clone());
        let phase = optional_trimmed_option(request.phase.clone())
            .unwrap_or_else(|| WORKFLOW_PHASE_INTAKE.to_owned());
        let current_step = optional_trimmed_option(request.current_step.clone())
            .unwrap_or_else(|| WORKFLOW_STEP_CREATED.to_owned());

        if workspace_id.is_empty() {
            return Ok(start_invalid_input(
                "workspaceId",
                "workspaceId is required.",
            ));
        }
        if workflow_id.is_empty() {
            return Ok(start_invalid_input("workflowId", "workflowId is required."));
        }
        if request_id.is_empty() {
            return Ok(start_invalid_input("requestId", "requestId is required."));
        }
        if self.store.get_workspace(&workspace_id)?.is_none() {
            return Ok(start_invalid_input(
                "workspaceId",
                "Workspace was not found for queue.workflow.start.",
            ));
        }
        if !is_supported_phase(&phase) {
            return Ok(start_invalid_input(
                "phase",
                "Queue workflow phase is not supported.",
            ));
        }

        let prepared = match prepare_workflow_snapshots(&workflow_id, &request) {
            Ok(prepared) => prepared,
            Err(blocker) => {
                return Ok(QueueWorkflowStartResult {
                    status: QueueWorkflowStartStatus::InvalidInput,
                    workflow_run: None,
                    conflict: None,
                    blocker: Some(blocker),
                });
            }
        };

        if let Some(existing) = self
            .store
            .get_agent_queue_workflow_run_by_request(&workspace_id, &request_id)?
        {
            if existing.request_hash == prepared.request_hash && existing.workflow_id == workflow_id
            {
                return Ok(QueueWorkflowStartResult {
                    status: QueueWorkflowStartStatus::AlreadyExists,
                    workflow_run: Some(QueueWorkflowRun::from(existing)),
                    conflict: None,
                    blocker: None,
                });
            }

            return Ok(QueueWorkflowStartResult {
                status: QueueWorkflowStartStatus::Conflict,
                workflow_run: Some(QueueWorkflowRun::from(existing.clone())),
                conflict: Some(QueueWorkflowConflict {
                    conflict_code: "request_id_hash_conflict".to_owned(),
                    conflict_message:
                        "A Queue workflow run already exists for this workspace/requestId with different typed request content."
                            .to_owned(),
                    existing_workflow_run_id: Some(existing.workflow_run_id),
                    existing_request_hash: Some(existing.request_hash),
                    requested_request_hash: Some(prepared.request_hash),
                }),
                blocker: None,
            });
        }

        let workflow_run_id = placeholder_id("queue-workflow-run-");
        let created_at = placeholder_timestamp();
        let row = self
            .store
            .with_immediate_transaction(|store| {
                let row = store.insert_agent_queue_workflow_run(NewAgentQueueWorkflowRun {
                    workflow_run_id: &workflow_run_id,
                    workspace_id: &workspace_id,
                    workflow_id: &workflow_id,
                    request_id: &request_id,
                    request_hash: &prepared.request_hash,
                    status: QueueWorkflowRunStatus::Created.as_str(),
                    phase: &phase,
                    current_step: Some(&current_step),
                    pause_reason: None,
                    blocker_reason: None,
                    actor_id: actor_id.as_deref(),
                    inputs_snapshot_json: prepared.inputs_snapshot_json.as_deref(),
                    grant_summary_json: prepared.grant_summary_json.as_deref(),
                    variables_json: prepared.variables_json.as_deref(),
                    slot_bindings_json: prepared.slot_bindings_json.as_deref(),
                    mutation_refs_json: prepared.mutation_refs_json.as_deref(),
                    idempotency_keys_json: prepared.idempotency_keys_json.as_deref(),
                    action_log_summary_json: prepared.action_log_summary_json.as_deref(),
                    version: QUEUE_WORKFLOW_INITIAL_VERSION,
                    schema_version: QUEUE_WORKFLOW_SCHEMA_VERSION,
                    created_at: Some(&created_at),
                    updated_at: Some(&created_at),
                    completed_at: None,
                })?;
                store.touch_workspace(&workspace_id)?;
                Ok(row)
            })
            .map_err(super::agent_queue_tasks::map_storage_agent_queue_task_error)?;

        Ok(QueueWorkflowStartResult {
            status: QueueWorkflowStartStatus::Succeeded,
            workflow_run: Some(QueueWorkflowRun::from(row)),
            conflict: None,
            blocker: None,
        })
    }

    pub fn get_queue_workflow_run(
        &self,
        request: QueueWorkflowGetRequest,
    ) -> Result<Option<QueueWorkflowRun>, WorkspaceServiceError> {
        Ok(self
            .store
            .get_agent_queue_workflow_run(
                request.workspace_id.trim(),
                request.workflow_run_id.trim(),
            )?
            .map(QueueWorkflowRun::from))
    }

    pub fn list_queue_workflow_runs(
        &self,
        request: QueueWorkflowListRequest,
    ) -> Result<Vec<QueueWorkflowRun>, WorkspaceServiceError> {
        let status = optional_trimmed_option(request.status);
        if let Some(status) = status.as_deref() {
            if QueueWorkflowRunStatus::from_str(status).is_none() {
                return Err(WorkspaceServiceError::InvalidInput(format!(
                    "unsupported queue workflow status: {status}"
                )));
            }
        }
        let workflow_id = optional_trimmed_option(request.workflow_id);
        Ok(self
            .store
            .list_agent_queue_workflow_runs(
                request.workspace_id.trim(),
                status.as_deref(),
                workflow_id.as_deref(),
            )?
            .into_iter()
            .map(QueueWorkflowRun::from)
            .collect())
    }

    pub fn cancel_queue_workflow_run(
        &self,
        request: QueueWorkflowCancelRequest,
    ) -> Result<QueueWorkflowCancelResult, WorkspaceServiceError> {
        let workspace_id = request.workspace_id.trim().to_owned();
        let workflow_run_id = request.workflow_run_id.trim().to_owned();

        if workspace_id.is_empty() {
            return Ok(cancel_invalid_input(
                "workspaceId",
                "workspaceId is required.",
            ));
        }
        if workflow_run_id.is_empty() {
            return Ok(cancel_invalid_input(
                "workflowRunId",
                "workflowRunId is required.",
            ));
        }

        let Some(existing) = self
            .store
            .get_agent_queue_workflow_run(&workspace_id, &workflow_run_id)?
        else {
            return Ok(QueueWorkflowCancelResult {
                status: QueueWorkflowCancelStatus::NotFound,
                workflow_run: None,
                blocker: Some(QueueWorkflowCommandBlocker {
                    blocker_code: "workflow_run_not_found".to_owned(),
                    blocker_message: "Queue workflow run was not found.".to_owned(),
                    missing_required_field: None,
                }),
            });
        };

        let existing_status = QueueWorkflowRunStatus::from_str(&existing.status)
            .unwrap_or(QueueWorkflowRunStatus::Failed);
        if existing_status == QueueWorkflowRunStatus::Cancelled {
            return Ok(QueueWorkflowCancelResult {
                status: QueueWorkflowCancelStatus::AlreadyCancelled,
                workflow_run: Some(QueueWorkflowRun::from(existing)),
                blocker: None,
            });
        }
        if existing_status.is_terminal() {
            return Ok(QueueWorkflowCancelResult {
                status: QueueWorkflowCancelStatus::AlreadyTerminal,
                workflow_run: Some(QueueWorkflowRun::from(existing)),
                blocker: Some(QueueWorkflowCommandBlocker {
                    blocker_code: "workflow_run_already_terminal".to_owned(),
                    blocker_message: "Completed or failed Queue workflow runs cannot be cancelled."
                        .to_owned(),
                    missing_required_field: None,
                }),
            });
        }

        let completed_at = placeholder_timestamp();
        let reason = optional_trimmed_option(request.reason)
            .unwrap_or_else(|| WORKFLOW_CANCEL_REASON.to_owned());
        let row = self
            .store
            .with_immediate_transaction(|store| {
                let row = store
                    .update_agent_queue_workflow_run_status(
                        &workspace_id,
                        &workflow_run_id,
                        AgentQueueWorkflowRunStatusUpdate {
                            status: QueueWorkflowRunStatus::Cancelled.as_str(),
                            phase: Some(WORKFLOW_PHASE_CLOSED),
                            current_step: Some(WORKFLOW_STEP_CANCELLED),
                            pause_reason: None,
                            blocker_reason: Some(&reason),
                            updated_at: Some(&completed_at),
                            completed_at: Some(&completed_at),
                        },
                    )?
                    .ok_or(StorageError::QueryReturnedNoRows)?;
                store.touch_workspace(&workspace_id)?;
                Ok(row)
            })
            .map_err(super::agent_queue_tasks::map_storage_agent_queue_task_error)?;

        Ok(QueueWorkflowCancelResult {
            status: QueueWorkflowCancelStatus::Cancelled,
            workflow_run: Some(QueueWorkflowRun::from(row)),
            blocker: None,
        })
    }

    pub fn get_queue_workflow_report(
        &self,
        request: QueueWorkflowGetRequest,
    ) -> Result<Option<QueueWorkflowReport>, WorkspaceServiceError> {
        let Some(run) = self.store.get_agent_queue_workflow_run(
            request.workspace_id.trim(),
            request.workflow_run_id.trim(),
        )?
        else {
            return Ok(None);
        };
        let actions = self
            .store
            .list_agent_queue_workflow_actions(&run.workspace_id, &run.workflow_run_id)?
            .into_iter()
            .map(QueueWorkflowAction::from)
            .collect::<Vec<_>>();
        let workflow_run = QueueWorkflowRun::from(run);

        Ok(Some(QueueWorkflowReport {
            report_summary: format!(
                "Queue workflow run {} is {}. Resume execution is not implemented.",
                workflow_run.workflow_run_id, workflow_run.status
            ),
            workflow_run,
            actions,
            resume_available: false,
            resume_status: "not_implemented".to_owned(),
        }))
    }
}

impl From<AgentQueueWorkflowRunRow> for QueueWorkflowRun {
    fn from(row: AgentQueueWorkflowRunRow) -> Self {
        Self {
            workflow_run_id: row.workflow_run_id,
            workspace_id: row.workspace_id,
            workflow_id: row.workflow_id,
            request_id: row.request_id,
            request_hash: row.request_hash,
            status: row.status,
            phase: row.phase,
            current_step: row.current_step,
            pause_reason: row.pause_reason,
            blocker_reason: row.blocker_reason,
            actor_id: row.actor_id,
            inputs_snapshot_json: row.inputs_snapshot_json,
            grant_summary_json: row.grant_summary_json,
            variables_json: row.variables_json,
            slot_bindings_json: row.slot_bindings_json,
            mutation_refs_json: row.mutation_refs_json,
            idempotency_keys_json: row.idempotency_keys_json,
            action_log_summary_json: row.action_log_summary_json,
            version: row.version,
            schema_version: row.schema_version,
            created_at: row.created_at,
            updated_at: row.updated_at,
            completed_at: row.completed_at,
        }
    }
}

impl From<AgentQueueWorkflowActionRow> for QueueWorkflowAction {
    fn from(row: AgentQueueWorkflowActionRow) -> Self {
        Self {
            action_id: row.action_id,
            workflow_run_id: row.workflow_run_id,
            workspace_id: row.workspace_id,
            step_id: row.step_id,
            action_type: row.action_type,
            idempotency_key: row.idempotency_key,
            status: row.status,
            target_refs_json: row.target_refs_json,
            result_refs_json: row.result_refs_json,
            blocker_code: row.blocker_code,
            blocker_message: row.blocker_message,
            attempt_count: row.attempt_count,
            started_at: row.started_at,
            completed_at: row.completed_at,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct PreparedWorkflowSnapshots {
    request_hash: String,
    inputs_snapshot_json: Option<String>,
    grant_summary_json: Option<String>,
    variables_json: Option<String>,
    slot_bindings_json: Option<String>,
    mutation_refs_json: Option<String>,
    idempotency_keys_json: Option<String>,
    action_log_summary_json: Option<String>,
}

fn prepare_workflow_snapshots(
    workflow_id: &str,
    request: &QueueWorkflowStartRequest,
) -> Result<PreparedWorkflowSnapshots, QueueWorkflowCommandBlocker> {
    let inputs_snapshot = bounded_canonical_json(
        request.inputs_snapshot.as_ref(),
        "inputsSnapshot",
        MAX_WORKFLOW_INPUTS_JSON_BYTES,
    )?;
    let grant_summary_value = request
        .grant_summary
        .as_ref()
        .map(safe_grant_summary)
        .transpose()?;
    let grant_summary_json = bounded_canonical_json(
        grant_summary_value.as_ref(),
        "grantSummary",
        MAX_WORKFLOW_GRANT_SUMMARY_JSON_BYTES,
    )?;
    let variables_json = bounded_canonical_json(
        request.variables.as_ref(),
        "variables",
        MAX_WORKFLOW_VARIABLES_JSON_BYTES,
    )?;
    let slot_bindings_json = bounded_canonical_json(
        request.slot_bindings.as_ref(),
        "slotBindings",
        MAX_WORKFLOW_SLOT_BINDINGS_JSON_BYTES,
    )?;
    let mutation_refs_json = bounded_canonical_json(
        request.mutation_refs.as_ref(),
        "mutationRefs",
        MAX_WORKFLOW_MUTATION_REFS_JSON_BYTES,
    )?;
    let idempotency_keys_json = bounded_canonical_json(
        request.idempotency_keys.as_ref(),
        "idempotencyKeys",
        MAX_WORKFLOW_IDEMPOTENCY_KEYS_JSON_BYTES,
    )?;
    let action_log_summary_json = bounded_canonical_json(
        request.action_log_summary.as_ref(),
        "actionLogSummary",
        MAX_WORKFLOW_ACTION_LOG_SUMMARY_JSON_BYTES,
    )?;
    let inputs_hash_value = request.inputs_snapshot.clone().unwrap_or(Value::Null);
    let grant_hash_value = grant_summary_value.clone().unwrap_or(Value::Null);
    let hash_value = serde_json::json!({
        "workflowId": workflow_id,
        "inputsSnapshot": inputs_hash_value,
        "grantSummary": grant_hash_value,
    });
    let request_hash = stable_request_hash(&canonical_json_string(&hash_value));

    Ok(PreparedWorkflowSnapshots {
        request_hash,
        inputs_snapshot_json: inputs_snapshot,
        grant_summary_json,
        variables_json,
        slot_bindings_json,
        mutation_refs_json,
        idempotency_keys_json,
        action_log_summary_json,
    })
}

fn bounded_canonical_json(
    value: Option<&Value>,
    field_name: &str,
    max_bytes: usize,
) -> Result<Option<String>, QueueWorkflowCommandBlocker> {
    let Some(value) = value else {
        return Ok(None);
    };
    if value.is_null() {
        return Ok(None);
    }

    let json = canonical_json_string(value);
    if json.len() > max_bytes {
        return Err(QueueWorkflowCommandBlocker {
            blocker_code: "workflow_json_too_large".to_owned(),
            blocker_message: format!("{field_name} exceeds the configured byte limit."),
            missing_required_field: Some(field_name.to_owned()),
        });
    }

    Ok(Some(json))
}

fn safe_grant_summary(value: &Value) -> Result<Value, QueueWorkflowCommandBlocker> {
    if contains_confirmation_token(value) {
        return Err(QueueWorkflowCommandBlocker {
            blocker_code: "confirmation_token_not_persistable".to_owned(),
            blocker_message:
                "confirmationToken must not be persisted as reusable workflow permission."
                    .to_owned(),
            missing_required_field: Some("grantSummary.confirmationToken".to_owned()),
        });
    }
    let Some(object) = value.as_object() else {
        return Err(QueueWorkflowCommandBlocker {
            blocker_code: "invalid_grant_summary".to_owned(),
            blocker_message: "grantSummary must be a JSON object.".to_owned(),
            missing_required_field: Some("grantSummary".to_owned()),
        });
    };

    let mut safe = serde_json::Map::new();
    for key in [
        "actorId",
        "mode",
        "allowedRiskClasses",
        "constraints",
        "scope",
        "issuedAt",
        "expiresAt",
        "restartPolicy",
        "maxActions",
        "consumedActionCount",
    ] {
        if let Some(value) = object.get(key) {
            safe.insert(key.to_owned(), value.clone());
        }
    }

    Ok(Value::Object(safe))
}

fn contains_confirmation_token(value: &Value) -> bool {
    match value {
        Value::Object(object) => object
            .iter()
            .any(|(key, value)| key == "confirmationToken" || contains_confirmation_token(value)),
        Value::Array(values) => values.iter().any(contains_confirmation_token),
        _ => false,
    }
}

fn canonical_json_string(value: &Value) -> String {
    match value {
        Value::Null => "null".to_owned(),
        Value::Bool(value) => value.to_string(),
        Value::Number(value) => value.to_string(),
        Value::String(value) => serde_json::to_string(value).expect("serialize JSON string"),
        Value::Array(values) => {
            let items = values
                .iter()
                .map(canonical_json_string)
                .collect::<Vec<_>>()
                .join(",");
            format!("[{items}]")
        }
        Value::Object(object) => {
            let sorted = object
                .iter()
                .collect::<BTreeMap<_, _>>()
                .into_iter()
                .map(|(key, value)| {
                    format!(
                        "{}:{}",
                        serde_json::to_string(key).expect("serialize JSON key"),
                        canonical_json_string(value)
                    )
                })
                .collect::<Vec<_>>()
                .join(",");
            format!("{{{sorted}}}")
        }
    }
}

fn stable_request_hash(canonical_json: &str) -> String {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in canonical_json.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }

    format!("fnv1a64:{hash:016x}")
}

fn start_invalid_input(field: &str, message: &str) -> QueueWorkflowStartResult {
    QueueWorkflowStartResult {
        status: QueueWorkflowStartStatus::InvalidInput,
        workflow_run: None,
        conflict: None,
        blocker: Some(QueueWorkflowCommandBlocker {
            blocker_code: format!("missing_{field}"),
            blocker_message: message.to_owned(),
            missing_required_field: Some(field.to_owned()),
        }),
    }
}

fn cancel_invalid_input(field: &str, message: &str) -> QueueWorkflowCancelResult {
    QueueWorkflowCancelResult {
        status: QueueWorkflowCancelStatus::InvalidInput,
        workflow_run: None,
        blocker: Some(QueueWorkflowCommandBlocker {
            blocker_code: format!("missing_{field}"),
            blocker_message: message.to_owned(),
            missing_required_field: Some(field.to_owned()),
        }),
    }
}

fn optional_trimmed_option(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let value = value.trim().to_owned();
        (!value.is_empty()).then_some(value)
    })
}

fn is_supported_phase(value: &str) -> bool {
    matches!(
        value,
        "intake" | "setup" | "run_start" | "worker_evidence" | "review" | "decision" | "closed"
    )
}
