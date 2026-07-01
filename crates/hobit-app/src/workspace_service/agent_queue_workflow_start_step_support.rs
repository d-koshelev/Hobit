use serde_json::{json, Map, Value};

use super::{
    agent_queue_workflow::{
        canonical_json_string, stable_fnv1a64_hash, QueueWorkflowCommandBlocker,
    },
    agent_queue_workflow_materialization::normalize_queue_workflow_task_spec_for_hash,
    agent_queue_workflow_setup::normalize_queue_workflow_run_settings_for_hash,
    QueueExecutionTargetSnapshot, QueueWorkflowExecutionTarget, QueueWorkflowRunSettings,
    QueueWorkflowTaskSpec,
};

pub(super) const START_TRANSITION: &str = "create_setup_start";
pub(super) const START_PHASE: &str = "run_start";
pub(super) const START_REQUESTED_STEP: &str = "create_setup_start_requested";
pub(super) const AWAITING_WORKER_STEP: &str = "awaiting_worker_completion";
pub(super) const AWAITING_WORKER_REASON: &str = "awaiting_worker_completion";
pub(super) const START_BLOCKED_STEP: &str = "start_worker_blocked";
pub(super) const CREATE_SETUP_START_BLOCKED_STEP: &str = "create_setup_start_blocked";
pub(super) const UPSTREAM_SLOT: &str = "upstream";
pub(super) const DOWNSTREAM_SLOT: &str = "downstream";
const QUEUE_LOCAL_TARGET_KIND: &str = "queue_local";
const AGENT_EXECUTOR_TARGET_KIND: &str = "agent_executor";
const CODEX_PROVIDER: &str = "codex";

#[derive(Clone, Debug, PartialEq)]
pub(super) struct NormalizedCreateSetupStartStepRequest {
    pub workspace_id: String,
    pub workflow_run_id: Option<String>,
    pub workflow_id: String,
    pub request_id: String,
    pub actor_id: String,
    pub inputs: Value,
    pub grant_summary: Option<Value>,
    pub confirmation_token: Option<String>,
    pub upstream_task: QueueWorkflowTaskSpec,
    pub upstream_task_spec_hash: String,
    pub downstream_task: QueueWorkflowTaskSpec,
    pub downstream_task_spec_hash: String,
    pub downstream_depends_on_slots: Vec<String>,
    pub run_settings: QueueWorkflowRunSettings,
    pub settings_hash: String,
    pub execution_target_hash: String,
    pub execution_target_kind: String,
    pub provider_id: String,
    pub queue_owner_widget_instance_id: Option<String>,
    pub executor_widget_id: Option<String>,
    pub expected_queue_control_version: Option<i64>,
}

pub(super) fn normalize_create_setup_start_step_request(
    request: super::agent_queue_workflow_start_step::QueueWorkflowCreateSetupStartStepRequest,
) -> Result<NormalizedCreateSetupStartStepRequest, QueueWorkflowCommandBlocker> {
    let workspace_id = required_string(request.workspace_id, "workspaceId")?;
    let workflow_id = required_string(request.workflow_id, "workflowId")?;
    if !matches!(
        workflow_id.as_str(),
        "dependency_acceptance_smoke" | "dependency_failure_smoke"
    ) {
        return Err(blocker(
            "unsupported_workflow",
            "Queue workflow create/setup/start is only supported for dependency smoke workflows.",
            Some("workflowId"),
        ));
    }
    let request_id = required_string(request.request_id, "requestId")?;
    let actor_id =
        optional_string(request.actor_id).unwrap_or_else(|| "workspace-agent".to_owned());
    let inputs = request.inputs.unwrap_or(Value::Object(Map::new()));
    if !inputs.is_object() {
        return Err(blocker(
            "invalid_inputs",
            "Queue workflow inputs must be a JSON object.",
            Some("inputs"),
        ));
    }

    let (
        upstream_task,
        upstream_task_spec_hash,
        downstream_task,
        downstream_task_spec_hash,
        depends,
    ) = parse_tasks(&inputs)?;
    let run_settings = parse_run_settings(&inputs)?;
    let (_, settings_hash) = normalize_queue_workflow_run_settings_for_hash(run_settings.clone())
        .map_err(|message| {
        blocker("invalid_run_settings", message, Some("inputs.runSettings"))
    })?;
    let target = execution_target_snapshot(&run_settings)?;
    let execution_target_hash = target.stable_hash();
    let expected_queue_control_version = number_field(
        record_field(&inputs, "runSettings"),
        "expectedQueueControlVersion",
    )
    .or_else(|| number_field(Some(&inputs), "expectedQueueControlVersion"))
    .or(request.expected_version);

    Ok(NormalizedCreateSetupStartStepRequest {
        workspace_id,
        workflow_run_id: optional_string(request.workflow_run_id),
        workflow_id,
        request_id,
        actor_id,
        inputs,
        grant_summary: safe_grant_summary(request.grant_summary)?,
        confirmation_token: optional_string(request.confirmation_token),
        upstream_task,
        upstream_task_spec_hash,
        downstream_task,
        downstream_task_spec_hash,
        downstream_depends_on_slots: depends,
        run_settings,
        settings_hash,
        execution_target_hash,
        execution_target_kind: target.execution_target_kind,
        provider_id: target.provider_id,
        queue_owner_widget_instance_id: target.queue_owner_widget_instance_id,
        executor_widget_id: target.executor_widget_id,
        expected_queue_control_version,
    })
}

pub(super) fn workflow_request_hash(
    workflow_id: &str,
    inputs: &Value,
    grant_summary: Option<&Value>,
) -> String {
    let hash_value = json!({
        "workflowId": workflow_id,
        "inputsSnapshot": inputs,
        "grantSummary": grant_summary.cloned().unwrap_or(Value::Null),
    });
    stable_fnv1a64_hash("fnv1a64", &canonical_json_string(&hash_value))
}

pub(super) fn start_worker_idempotency_key(
    workflow_run_id: &str,
    task_id: &str,
    execution_target_hash: &str,
    settings_hash: &str,
) -> String {
    format!("{workflow_run_id}:start_worker:{task_id}:{execution_target_hash}:{settings_hash}")
}

pub(super) fn command_blocker_from_message(
    code: &str,
    message: impl Into<String>,
) -> QueueWorkflowCommandBlocker {
    blocker(code, message, None)
}

pub(super) fn blocker(
    blocker_code: &str,
    blocker_message: impl Into<String>,
    missing_required_field: Option<&str>,
) -> QueueWorkflowCommandBlocker {
    QueueWorkflowCommandBlocker {
        blocker_code: blocker_code.to_owned(),
        blocker_message: blocker_message.into(),
        missing_required_field: missing_required_field.map(str::to_owned),
    }
}

fn parse_tasks(
    inputs: &Value,
) -> Result<
    (
        QueueWorkflowTaskSpec,
        String,
        QueueWorkflowTaskSpec,
        String,
        Vec<String>,
    ),
    QueueWorkflowCommandBlocker,
> {
    let tasks = record_field(inputs, "tasks")
        .and_then(Value::as_array)
        .ok_or_else(|| {
            blocker(
                "tasks_missing",
                "inputs.tasks is required.",
                Some("inputs.tasks"),
            )
        })?;
    let mut upstream: Option<QueueWorkflowTaskSpec> = None;
    let mut downstream: Option<(QueueWorkflowTaskSpec, Vec<String>)> = None;

    for task in tasks {
        let slot = string_field(Some(task), "slot").ok_or_else(|| {
            blocker(
                "task_slot_missing",
                "Each task requires a slot.",
                Some("inputs.tasks[].slot"),
            )
        })?;
        let spec = QueueWorkflowTaskSpec {
            title: string_field(Some(task), "title").ok_or_else(|| {
                blocker(
                    "task_title_missing",
                    "Each task requires title.",
                    Some("inputs.tasks[].title"),
                )
            })?,
            prompt: string_field(Some(task), "prompt").ok_or_else(|| {
                blocker(
                    "task_prompt_missing",
                    "Each task requires prompt.",
                    Some("inputs.tasks[].prompt"),
                )
            })?,
            description: string_field(Some(task), "description"),
            status: string_field(Some(task), "status"),
            priority: number_field(Some(task), "priority"),
        };
        let depends_on_slots = string_array_field(task, "dependsOnSlots")?;
        match slot.as_str() {
            UPSTREAM_SLOT => {
                if upstream.replace(spec).is_some() {
                    return Err(blocker(
                        "duplicate_slot",
                        "Duplicate upstream task slot.",
                        Some("inputs.tasks"),
                    ));
                }
                if !depends_on_slots.is_empty() {
                    return Err(blocker(
                        "invalid_dependency_slots",
                        "Upstream task must not depend on downstream or inferred slots.",
                        Some("inputs.tasks[].dependsOnSlots"),
                    ));
                }
            }
            DOWNSTREAM_SLOT => {
                if downstream.replace((spec, depends_on_slots)).is_some() {
                    return Err(blocker(
                        "duplicate_slot",
                        "Duplicate downstream task slot.",
                        Some("inputs.tasks"),
                    ));
                }
            }
            _ => {
                return Err(blocker(
                    "unknown_task_slot",
                    "Queue dependency smoke tasks must use explicit upstream/downstream slots.",
                    Some("inputs.tasks[].slot"),
                ));
            }
        }
    }

    let upstream = upstream.ok_or_else(|| {
        blocker(
            "upstream_missing",
            "Upstream task slot is required.",
            Some("inputs.tasks"),
        )
    })?;
    let (downstream, depends) = downstream.ok_or_else(|| {
        blocker(
            "downstream_missing",
            "Downstream task slot is required.",
            Some("inputs.tasks"),
        )
    })?;
    if depends != [UPSTREAM_SLOT.to_owned()] {
        return Err(blocker(
            "dependency_edge_missing",
            "Downstream task must explicitly depend on the upstream slot.",
            Some("inputs.tasks[].dependsOnSlots"),
        ));
    }
    let (_, _, upstream_hash, _) =
        normalize_queue_workflow_task_spec_for_hash(upstream.clone(), Vec::new())
            .map_err(|message| blocker("invalid_task_spec", message, Some("inputs.tasks")))?;
    let (_, _, downstream_hash, _) =
        normalize_queue_workflow_task_spec_for_hash(downstream.clone(), depends.clone())
            .map_err(|message| blocker("invalid_task_spec", message, Some("inputs.tasks")))?;
    Ok((
        upstream,
        upstream_hash,
        downstream,
        downstream_hash,
        depends,
    ))
}

fn parse_run_settings(
    inputs: &Value,
) -> Result<QueueWorkflowRunSettings, QueueWorkflowCommandBlocker> {
    let settings = record_field(inputs, "runSettings").ok_or_else(|| {
        blocker(
            "run_settings_missing",
            "inputs.runSettings is required.",
            Some("inputs.runSettings"),
        )
    })?;
    let execution_workspace = string_field(Some(settings), "executionWorkspace")
        .or_else(|| string_field(Some(settings), "workspaceRoot"))
        .ok_or_else(|| {
            blocker(
                "execution_workspace_missing",
                "runSettings.workspaceRoot is required.",
                Some("inputs.runSettings.workspaceRoot"),
            )
        })?;
    let execution_target =
        record_field(settings, "executionTarget").map(|target| QueueWorkflowExecutionTarget {
            kind: string_field(Some(target), "kind")
                .unwrap_or_else(|| QUEUE_LOCAL_TARGET_KIND.to_owned()),
            provider_id: string_field(Some(target), "providerId")
                .unwrap_or_else(|| CODEX_PROVIDER.to_owned()),
            queue_owner_widget_instance_id: string_field(
                Some(target),
                "queueOwnerWidgetInstanceId",
            ),
            executor_widget_id: string_field(Some(target), "executorWidgetId"),
        });
    Ok(QueueWorkflowRunSettings {
        execution_workspace,
        codex_executable: string_field(Some(settings), "codexExecutable").ok_or_else(|| {
            blocker(
                "codex_executable_missing",
                "runSettings.codexExecutable is required.",
                Some("inputs.runSettings.codexExecutable"),
            )
        })?,
        sandbox: string_field(Some(settings), "sandbox").ok_or_else(|| {
            blocker(
                "sandbox_missing",
                "runSettings.sandbox is required.",
                Some("inputs.runSettings.sandbox"),
            )
        })?,
        approval_policy: string_field(Some(settings), "approvalPolicy").ok_or_else(|| {
            blocker(
                "approval_policy_missing",
                "runSettings.approvalPolicy is required.",
                Some("inputs.runSettings.approvalPolicy"),
            )
        })?,
        execution_policy: string_field(Some(settings), "executionPolicy")
            .unwrap_or_else(|| "manual".to_owned()),
        execution_target,
        executor_widget_id: string_field(Some(settings), "executorWidgetId").unwrap_or_default(),
    })
}

fn execution_target_snapshot(
    settings: &QueueWorkflowRunSettings,
) -> Result<QueueExecutionTargetSnapshot, QueueWorkflowCommandBlocker> {
    let target = settings.execution_target.as_ref();
    let kind = target
        .map(|target| target.kind.trim())
        .filter(|kind| !kind.is_empty())
        .unwrap_or(if settings.executor_widget_id.trim().is_empty() {
            QUEUE_LOCAL_TARGET_KIND
        } else {
            AGENT_EXECUTOR_TARGET_KIND
        });
    let provider_id = target
        .map(|target| target.provider_id.trim())
        .filter(|provider_id| !provider_id.is_empty())
        .unwrap_or(CODEX_PROVIDER);
    if provider_id != CODEX_PROVIDER {
        return Err(blocker(
            "unsupported_provider",
            "Queue workflow start supports only providerId codex.",
            Some("inputs.runSettings.executionTarget.providerId"),
        ));
    }
    Ok(QueueExecutionTargetSnapshot {
        execution_target_kind: kind.to_owned(),
        provider_id: provider_id.to_owned(),
        queue_owner_widget_instance_id: target
            .and_then(|target| target.queue_owner_widget_instance_id.clone()),
        executor_widget_id: if kind == QUEUE_LOCAL_TARGET_KIND {
            None
        } else {
            target
                .and_then(|target| target.executor_widget_id.clone())
                .or_else(|| optional_string(Some(settings.executor_widget_id.clone())))
        },
    })
}

fn safe_grant_summary(value: Option<Value>) -> Result<Option<Value>, QueueWorkflowCommandBlocker> {
    let Some(value) = value else {
        return Ok(None);
    };
    let Some(object) = value.as_object() else {
        return Err(blocker(
            "invalid_grant_summary",
            "grantSummary must be a JSON object.",
            Some("grantSummary"),
        ));
    };
    let mut safe = Map::new();
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
    let safe = Value::Object(safe);
    if contains_confirmation_token(&safe) {
        return Err(blocker(
            "confirmation_token_not_persistable",
            "confirmationToken must not be persisted as reusable workflow permission.",
            Some("grantSummary.confirmationToken"),
        ));
    }
    Ok(Some(safe))
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

fn record_field<'a>(value: &'a Value, field: &str) -> Option<&'a Value> {
    value.as_object().and_then(|object| object.get(field))
}

fn string_field(value: Option<&Value>, field: &str) -> Option<String> {
    value
        .and_then(|value| record_field(value, field))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}

fn number_field(value: Option<&Value>, field: &str) -> Option<i64> {
    value
        .and_then(|value| record_field(value, field))
        .and_then(Value::as_i64)
}

fn string_array_field(
    value: &Value,
    field: &str,
) -> Result<Vec<String>, QueueWorkflowCommandBlocker> {
    let Some(raw) = record_field(value, field) else {
        return Ok(Vec::new());
    };
    let Some(values) = raw.as_array() else {
        return Err(blocker(
            "invalid_string_array",
            "dependsOnSlots must be an array.",
            Some("inputs.tasks[].dependsOnSlots"),
        ));
    };
    values
        .iter()
        .map(|value| {
            value
                .as_str()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_owned)
                .ok_or_else(|| {
                    blocker(
                        "invalid_string_array",
                        "dependsOnSlots entries must be strings.",
                        Some("inputs.tasks[].dependsOnSlots"),
                    )
                })
        })
        .collect()
}

fn required_string(value: String, field: &str) -> Result<String, QueueWorkflowCommandBlocker> {
    optional_string(Some(value)).ok_or_else(|| {
        blocker(
            "missing_required_field",
            format!("{field} is required."),
            Some(field),
        )
    })
}

fn optional_string(value: Option<String>) -> Option<String> {
    value
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}
