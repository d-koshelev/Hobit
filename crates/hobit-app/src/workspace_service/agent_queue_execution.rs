use hobit_storage_sqlite::{
    AgentQueueTaskRunLinkRow, AgentQueueWorkflowActionRow, AgentQueueWorkflowActionUpdate,
    NewAgentQueueWorkflowAction,
};
use serde_json::{Map, Value};

use crate::WorkspaceServiceError;

use super::{
    agent_queue_context::materialize_queue_task_context_prompt,
    agent_queue_control::{
        ensure_default_control_state, AGENT_QUEUE_CONTROL_STATUS_MANUAL_ENABLED,
    },
    agent_queue_lifecycle::{
        map_direct_work_final_status_to_queue_status, AgentQueueExecutionLifecycleStatus,
        AgentQueueTaskLifecycleStatus, AGENT_QUEUE_TASK_STATUS_RUNNING,
    },
    agent_queue_run_links::{
        record_agent_queue_task_run_final_status_in_store,
        record_agent_queue_task_run_started_in_store,
    },
    agent_queue_tasks::{
        load_agent_executor_widget, load_agent_queue_task, map_storage_agent_queue_task_error,
        storage_invalid_input,
    },
    direct_work::{
        can_initiate_direct_work, normalize_direct_work_input, CODEX_DIRECT_WORK_COMMAND_KIND,
    },
    direct_work_stream::insert_codex_direct_work_stream_start,
    mapping::agent_queue_task_summary,
    placeholder_id, placeholder_timestamp,
    validation::{required_input, validate_widget_run_ownership},
    AgentQueueTaskRunSource, AgentQueueTaskRunStatus, AgentQueueTaskSummary,
    AssignedAgentQueueTaskRunPlan, AssignedAgentQueueTaskStartSummary,
    FinishAssignedAgentQueueTaskRunInput, QueueWorkerStartBlocker, QueueWorkerStartContext,
    QueueWorkerStartSettingsSnapshot, QueueWorkflowActionStatus, RunCodexDirectWorkInput,
    StartAssignedAgentQueueTaskInput, WorkspaceService, AGENT_QUEUE_WIDGET_DEFINITION_ID,
    AGENT_RUN_WIDGET_DEFINITION_ID,
};

const QUEUE_WORKER_START_ACTION_TYPE: &str = "start_worker";
const QUEUE_WORKER_START_STEP_ID: &str = "start_worker";
const QUEUE_WORKER_START_CONFIRMATION_TOKEN: &str = "operator-confirmed";
const QUEUE_WORKER_START_STATUS_ALREADY_STARTED: &str = "already_started";

impl WorkspaceService {
    pub fn prepare_assigned_agent_queue_task_run(
        &self,
        input: StartAssignedAgentQueueTaskInput,
    ) -> Result<AssignedAgentQueueTaskRunPlan, WorkspaceServiceError> {
        let input = normalize_start_assigned_agent_queue_task_input(input)?;
        let task =
            load_runnable_agent_queue_task(&self.store, &input.workspace_id, &input.queue_item_id)
                .map_err(map_storage_agent_queue_task_error)?;
        let executor = load_agent_queue_direct_work_owner(
            &self.store,
            &input.workspace_id,
            input.queue_owner_widget_instance_id.as_deref(),
            task.assigned_executor_widget_id.as_deref(),
        )
        .map_err(map_storage_agent_queue_task_error)?;
        let direct_work_input = build_direct_work_input(
            &input,
            executor.workbench_id.clone(),
            executor.id.clone(),
            operator_prompt_for_queue_task(&task)?,
        )?;

        Ok(AssignedAgentQueueTaskRunPlan {
            workspace_id: input.workspace_id,
            queue_item_id: input.queue_item_id,
            workbench_id: executor.workbench_id,
            executor_widget_instance_id: executor.id,
            direct_work_input,
        })
    }

    pub fn start_assigned_agent_queue_task(
        &self,
        input: StartAssignedAgentQueueTaskInput,
    ) -> Result<AssignedAgentQueueTaskStartSummary, WorkspaceServiceError> {
        self.start_assigned_agent_queue_task_with_run_source(input, AgentQueueTaskRunSource::Manual)
    }

    pub fn start_assigned_agent_queue_task_with_run_source(
        &self,
        input: StartAssignedAgentQueueTaskInput,
        source: AgentQueueTaskRunSource,
    ) -> Result<AssignedAgentQueueTaskStartSummary, WorkspaceServiceError> {
        let input = normalize_start_assigned_agent_queue_task_input(input)?;
        let updated_at = placeholder_timestamp();

        let result = self
            .store
            .with_immediate_transaction(|store| {
                if let Some(workflow_context) = input.workflow_start_context.as_ref() {
                    if let Some(existing) =
                        resolve_existing_workflow_start(store, &input, workflow_context)?
                    {
                        return Ok(existing);
                    }
                }

                let control = ensure_default_control_state(store, &input.workspace_id)?;
                if let Some(workflow_context) = input.workflow_start_context.as_ref() {
                    if let Some(expected_version) = workflow_context.expected_queue_control_version
                    {
                        if control.version != expected_version {
                            return record_workflow_start_blocked(
                                store,
                                &input,
                                workflow_context,
                                workflow_start_blocker(
                                    "version_conflict",
                                    format!(
                                        "Queue control state version conflict: expected {expected_version}, actual {}.",
                                        control.version
                                    ),
                                    Some(&input.queue_item_id),
                                    Some(&workflow_context.executor_widget_id),
                                    None,
                                    Some(control.status.as_str()),
                                    Some(expected_version),
                                    Some(control.version),
                                    Some("expected_queue_control_version"),
                                ),
                            );
                        }
                    }
                }

                if control.status != AGENT_QUEUE_CONTROL_STATUS_MANUAL_ENABLED {
                    let blocker = workflow_start_blocker(
                        "blocked_control_disabled",
                        "Queue control state is disabled; enable manual Queue control before starting workers.",
                        Some(&input.queue_item_id),
                        input.workflow_start_context
                            .as_ref()
                            .map(|context| context.executor_widget_id.as_str()),
                        None,
                        Some(control.status.as_str()),
                        input
                            .workflow_start_context
                            .as_ref()
                            .and_then(|context| context.expected_queue_control_version),
                        Some(control.version),
                        None,
                    );
                    if let Some(workflow_context) = input.workflow_start_context.as_ref() {
                        return record_workflow_start_blocked(
                            store,
                            &input,
                            workflow_context,
                            blocker,
                        );
                    }
                    return Ok(StartTransactionResult::Blocked(blocker));
                }

                let task = if let Some(workflow_context) = input.workflow_start_context.as_ref() {
                    match load_workflow_start_runnable_task(store, &input, workflow_context)? {
                        StartTaskReadiness::Runnable(task) => task,
                        StartTaskReadiness::Blocked(blocked) => return Ok(blocked),
                    }
                } else {
                    load_runnable_agent_queue_task(
                        store,
                        &input.workspace_id,
                        &input.queue_item_id,
                    )?
                };
                if let Some(workflow_context) = input.workflow_start_context.as_ref() {
                    if let Err(blocker) =
                        validate_queue_task_dependencies_ready(store, &input.workspace_id, &task)
                    {
                        return record_workflow_start_blocked(
                            store,
                            &input,
                            workflow_context,
                            blocker,
                        );
                    }
                } else {
                    validate_queue_task_dependencies_ready(store, &input.workspace_id, &task)
                        .map_err(workflow_start_storage_error)?;
                }
                let executor = load_agent_queue_direct_work_owner(
                    store,
                    &input.workspace_id,
                    input.queue_owner_widget_instance_id.as_deref(),
                    task.assigned_executor_widget_id.as_deref(),
                )?;
                let settings_snapshot = effective_worker_start_settings(&input, &task, &executor.id);
                let settings_hash = settings_snapshot.stable_hash();
                if let Some(workflow_context) = input.workflow_start_context.as_ref() {
                    if workflow_context.executor_widget_id != executor.id {
                        return record_workflow_start_blocked(
                            store,
                            &input,
                            workflow_context,
                            workflow_start_blocker(
                                "executor_binding_mismatch",
                                "workflow worker start executorWidgetId does not match the task's explicit executor binding.",
                                Some(&input.queue_item_id),
                                Some(&workflow_context.executor_widget_id),
                                None,
                                None,
                                workflow_context.expected_queue_control_version,
                                Some(control.version),
                                Some("executor_widget_id"),
                            ),
                        );
                    }
                    if let Some(blocker) =
                        validate_workflow_start_run_settings(&input, &task, workflow_context, &settings_hash)
                    {
                        return record_workflow_start_blocked(
                            store,
                            &input,
                            workflow_context,
                            blocker,
                        );
                    }
                    if let Some(active_link) = latest_active_task_run_link(
                        store,
                        &input.workspace_id,
                        &input.queue_item_id,
                    )? {
                        return record_workflow_start_blocked(
                            store,
                            &input,
                            workflow_context,
                            workflow_start_blocker(
                                "active_run_conflict",
                                "queue task already has an active run that is not owned by this workflow start action.",
                                Some(&input.queue_item_id),
                                Some(&active_link.executor_widget_id),
                                Some(&active_link.direct_work_run_id),
                                Some(active_link.status.as_str()),
                                workflow_context.expected_queue_control_version,
                                Some(control.version),
                                None,
                            ),
                        );
                    }
                    insert_workflow_start_action(
                        store,
                        workflow_context,
                        &input.workspace_id,
                        &workflow_start_target_refs_json(workflow_context),
                        &updated_at,
                    )?;
                }
                let direct_work_input = build_direct_work_input(
                    &input,
                    executor.workbench_id.clone(),
                    executor.id.clone(),
                    operator_prompt_for_queue_task(&task)
                        .map_err(|error| storage_invalid_input(error.to_string()))?,
                )
                .map_err(|error| storage_invalid_input(error.to_string()))?;
                let normalized_direct_work_input =
                    normalize_direct_work_input(direct_work_input.clone())
                        .map_err(|error| storage_invalid_input(error.to_string()))?;
                let start =
                    insert_codex_direct_work_stream_start(store, &normalized_direct_work_input)?
                        .ok_or_else(|| {
                            storage_invalid_input(
                                "assigned Agent Executor could not start Direct Work".to_owned(),
                            )
                        })?;
                record_agent_queue_task_run_started_in_store(
                    store,
                    &input.workspace_id,
                    &input.queue_item_id,
                    &executor.id,
                    &start.run_id,
                    source,
                )?;
                let task = store
                    .update_agent_queue_task_status(
                        &input.workspace_id,
                        &input.queue_item_id,
                        AGENT_QUEUE_TASK_STATUS_RUNNING,
                        Some(&updated_at),
                    )?
                    .ok_or(hobit_storage_sqlite::StorageError::QueryReturnedNoRows)?;
                store.touch_workspace(&input.workspace_id)?;

                if let Some(workflow_context) = input.workflow_start_context.as_ref() {
                    let result_refs_json = workflow_start_result_refs_json(
                        &start.run_id,
                        AgentQueueTaskRunStatus::Running.as_str(),
                    );
                    store.update_agent_queue_workflow_action(
                        &input.workspace_id,
                        &workflow_context.workflow_run_id,
                        &workflow_context.action_idempotency_key,
                        AgentQueueWorkflowActionUpdate {
                            status: QueueWorkflowActionStatus::Completed.as_str(),
                            result_refs_json: Some(&result_refs_json),
                            blocker_code: None,
                            blocker_message: None,
                            attempt_count: Some(1),
                            started_at: Some(&updated_at),
                            completed_at: Some(&updated_at),
                            updated_at: Some(&updated_at),
                        },
                    )?
                    .ok_or_else(|| {
                        storage_invalid_input(
                            "workflow start action was not found after worker start".to_owned(),
                        )
                    })?;
                }

                Ok(StartTransactionResult::Started(AssignedAgentQueueTaskStartSummary {
                    workspace_id: task.workspace_id,
                    queue_item_id: task.queue_item_id,
                    workbench_id: executor.workbench_id,
                    executor_widget_instance_id: executor.id,
                    run_id: start.run_id,
                    status: AgentQueueExecutionLifecycleStatus::Started
                        .as_str()
                        .to_owned(),
                    direct_work_input,
                    workflow_run_id: input
                        .workflow_start_context
                        .as_ref()
                        .map(|context| context.workflow_run_id.clone()),
                    workflow_action_id: input
                        .workflow_start_context
                        .as_ref()
                        .and_then(|context| context.workflow_action_id.clone()),
                    action_idempotency_key: input
                        .workflow_start_context
                        .as_ref()
                        .map(|context| context.action_idempotency_key.clone()),
                    settings_hash: input
                        .workflow_start_context
                        .as_ref()
                        .map(|_| settings_hash),
                    current_run_state: Some(AgentQueueTaskRunStatus::Running.as_str().to_owned()),
                    blocker: None,
                }))
            })
            .map_err(map_storage_agent_queue_task_error)?;

        match result {
            StartTransactionResult::Started(summary) => Ok(summary),
            StartTransactionResult::Blocked(blocker) => Err(WorkspaceServiceError::InvalidInput(
                workflow_start_blocker_message(&blocker),
            )),
        }
    }

    pub fn finish_assigned_agent_queue_task_run(
        &self,
        input: FinishAssignedAgentQueueTaskRunInput,
    ) -> Result<AgentQueueTaskSummary, WorkspaceServiceError> {
        let input = normalize_finish_assigned_agent_queue_task_run_input(input)?;
        let queue_status = map_direct_work_status_to_queue_status(&input.direct_work_status)?;
        let updated_at = placeholder_timestamp();

        self.store
            .with_immediate_transaction(|store| {
                let task = load_agent_queue_task(store, &input.workspace_id, &input.queue_item_id)?;
                if task.status != AGENT_QUEUE_TASK_STATUS_RUNNING {
                    return Err(storage_invalid_input(format!(
                        "queue task is not running: {}",
                        task.status
                    )));
                }

                let executor = load_agent_queue_direct_work_owner_by_id(
                    store,
                    &input.workspace_id,
                    &input.executor_widget_instance_id,
                )?;
                if executor.definition_id == AGENT_RUN_WIDGET_DEFINITION_ID
                    && task.assigned_executor_widget_id.as_deref() != Some(executor.id.as_str())
                {
                    return Err(storage_invalid_input(
                        "queue task is not assigned to the completed executor".to_owned(),
                    ));
                }

                let Some((_workspace, _workbench, widget, run)) = validate_widget_run_ownership(
                    store,
                    &input.workspace_id,
                    &executor.workbench_id,
                    &executor.id,
                    &input.run_id,
                )?
                else {
                    return Err(storage_invalid_input(format!(
                        "Direct Work run not found for queue task: {}",
                        input.run_id
                    )));
                };

                if !can_initiate_direct_work(&widget.definition_id)
                    || run.command_kind.as_deref() != Some(CODEX_DIRECT_WORK_COMMAND_KIND)
                {
                    return Err(storage_invalid_input(
                        "queue task run is not an Agent Executor Direct Work run".to_owned(),
                    ));
                }

                let task = store
                    .update_agent_queue_task_status(
                        &input.workspace_id,
                        &input.queue_item_id,
                        queue_status,
                        Some(&updated_at),
                    )?
                    .ok_or(hobit_storage_sqlite::StorageError::QueryReturnedNoRows)?;
                let _ = record_agent_queue_task_run_final_status_in_store(
                    store,
                    &input.workspace_id,
                    &input.queue_item_id,
                    &executor.id,
                    &input.run_id,
                    &input.direct_work_status,
                )?;
                store.touch_workspace(&input.workspace_id)?;
                Ok(task)
            })
            .map(agent_queue_task_summary)
            .map_err(map_storage_agent_queue_task_error)
    }
}

fn operator_prompt_for_queue_task(
    task: &hobit_storage_sqlite::AgentQueueTaskRow,
) -> Result<String, WorkspaceServiceError> {
    materialize_queue_task_context_prompt(task)
        .map_err(WorkspaceServiceError::InvalidInput)
        .map(|prompt| prompt.unwrap_or_else(|| task.prompt.clone()))
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedStartAssignedAgentQueueTaskInput {
    workspace_id: String,
    queue_item_id: String,
    queue_owner_widget_instance_id: Option<String>,
    codex_executable: String,
    repo_root: std::path::PathBuf,
    sandbox: String,
    approval_policy: String,
    timeout_ms: Option<u64>,
    stdout_cap_bytes: Option<usize>,
    stderr_cap_bytes: Option<usize>,
    workflow_start_context: Option<NormalizedQueueWorkerStartContext>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedFinishAssignedAgentQueueTaskRunInput {
    workspace_id: String,
    queue_item_id: String,
    executor_widget_instance_id: String,
    run_id: String,
    direct_work_status: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedQueueWorkerStartContext {
    workflow_run_id: String,
    workflow_action_id: Option<String>,
    action_idempotency_key: String,
    task_id: String,
    executor_widget_id: String,
    settings_hash: String,
    expected_queue_control_version: Option<i64>,
    actor_id: Option<String>,
    confirmation_token: String,
}

fn normalize_start_assigned_agent_queue_task_input(
    input: StartAssignedAgentQueueTaskInput,
) -> Result<NormalizedStartAssignedAgentQueueTaskInput, WorkspaceServiceError> {
    if input.repo_root.as_os_str().is_empty() {
        return Err(WorkspaceServiceError::InvalidInput(
            "repo root must not be empty".to_owned(),
        ));
    }

    let queue_item_id = required_input(&input.queue_item_id, "queue item id")?.to_owned();
    let workflow_start_context = input
        .workflow_start_context
        .map(|context| normalize_queue_worker_start_context(context, &queue_item_id))
        .transpose()?;

    Ok(NormalizedStartAssignedAgentQueueTaskInput {
        workspace_id: required_input(&input.workspace_id, "workspace id")?.to_owned(),
        queue_item_id,
        queue_owner_widget_instance_id: input
            .queue_owner_widget_instance_id
            .map(|widget_id| widget_id.trim().to_owned())
            .filter(|widget_id| !widget_id.is_empty()),
        codex_executable: required_input(&input.codex_executable, "codex executable")?.to_owned(),
        repo_root: input.repo_root,
        sandbox: required_input(&input.sandbox, "direct work sandbox")?.to_owned(),
        approval_policy: required_input(&input.approval_policy, "direct work approval policy")?
            .to_owned(),
        timeout_ms: input.timeout_ms,
        stdout_cap_bytes: input.stdout_cap_bytes,
        stderr_cap_bytes: input.stderr_cap_bytes,
        workflow_start_context,
    })
}

fn normalize_queue_worker_start_context(
    context: QueueWorkerStartContext,
    input_queue_item_id: &str,
) -> Result<NormalizedQueueWorkerStartContext, WorkspaceServiceError> {
    let workflow_run_id = required_input(&context.workflow_run_id, "workflow run id")?.to_owned();
    let workflow_action_id = normalize_optional_context_field(context.workflow_action_id);
    let explicit_idempotency_key = normalize_optional_context_field(context.action_idempotency_key);
    if workflow_action_id.is_none() && explicit_idempotency_key.is_none() {
        return Err(WorkspaceServiceError::InvalidInput(
            "workflow worker start requires workflowActionId or actionIdempotencyKey".to_owned(),
        ));
    }

    let task_id = required_input(&context.task_id, "workflow worker start task id")?.to_owned();
    if task_id != input_queue_item_id {
        return Err(WorkspaceServiceError::InvalidInput(
            "workflow worker start taskId must match queueItemId".to_owned(),
        ));
    }

    let executor_widget_id = required_input(
        &context.executor_widget_id,
        "workflow worker start executor widget id",
    )?
    .to_owned();
    let settings_hash = required_input(
        &context.settings_hash,
        "workflow worker start settings hash",
    )?
    .to_owned();
    let confirmation_token = required_input(
        context.confirmation_token.as_deref().unwrap_or_default(),
        "workflow worker start confirmation token",
    )?
    .to_owned();
    if confirmation_token != QUEUE_WORKER_START_CONFIRMATION_TOKEN {
        return Err(WorkspaceServiceError::InvalidInput(
            "workflow worker start confirmation token does not match the required operator confirmation"
                .to_owned(),
        ));
    }

    if context
        .expected_queue_control_version
        .is_some_and(|version| version < 0)
    {
        return Err(WorkspaceServiceError::InvalidInput(
            "expected queue control version must not be negative".to_owned(),
        ));
    }

    let action_idempotency_key = explicit_idempotency_key.unwrap_or_else(|| {
        workflow_start_idempotency_key(
            &workflow_run_id,
            &task_id,
            &executor_widget_id,
            &settings_hash,
        )
    });

    Ok(NormalizedQueueWorkerStartContext {
        workflow_run_id,
        workflow_action_id,
        action_idempotency_key,
        task_id,
        executor_widget_id,
        settings_hash,
        expected_queue_control_version: context.expected_queue_control_version,
        actor_id: normalize_optional_context_field(context.actor_id),
        confirmation_token,
    })
}

fn normalize_optional_context_field(value: Option<String>) -> Option<String> {
    value
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

fn workflow_start_idempotency_key(
    workflow_run_id: &str,
    task_id: &str,
    executor_widget_id: &str,
    settings_hash: &str,
) -> String {
    format!("{workflow_run_id}:start_worker:{task_id}:{executor_widget_id}:{settings_hash}")
}

fn normalize_finish_assigned_agent_queue_task_run_input(
    input: FinishAssignedAgentQueueTaskRunInput,
) -> Result<NormalizedFinishAssignedAgentQueueTaskRunInput, WorkspaceServiceError> {
    Ok(NormalizedFinishAssignedAgentQueueTaskRunInput {
        workspace_id: required_input(&input.workspace_id, "workspace id")?.to_owned(),
        queue_item_id: required_input(&input.queue_item_id, "queue item id")?.to_owned(),
        executor_widget_instance_id: required_input(
            &input.executor_widget_instance_id,
            "executor widget instance id",
        )?
        .to_owned(),
        run_id: required_input(&input.run_id, "run id")?.to_owned(),
        direct_work_status: required_input(&input.direct_work_status, "direct work status")?
            .to_owned(),
    })
}

fn load_runnable_agent_queue_task(
    store: &hobit_storage_sqlite::SqliteStore,
    workspace_id: &str,
    queue_item_id: &str,
) -> Result<hobit_storage_sqlite::AgentQueueTaskRow, hobit_storage_sqlite::StorageError> {
    let task = load_agent_queue_task(store, workspace_id, queue_item_id)?;

    if !is_runnable_agent_queue_task_status(&task.status) {
        return Err(storage_invalid_input(format!(
            "queue task status cannot be run: {}",
            task.status
        )));
    }

    if task.prompt.trim().is_empty() {
        return Err(storage_invalid_input(
            "queue task prompt must not be empty before running".to_owned(),
        ));
    }

    Ok(task)
}

fn load_agent_queue_direct_work_owner(
    store: &hobit_storage_sqlite::SqliteStore,
    workspace_id: &str,
    queue_owner_widget_instance_id: Option<&str>,
    assigned_executor_widget_id: Option<&str>,
) -> Result<hobit_storage_sqlite::WidgetInstanceRow, hobit_storage_sqlite::StorageError> {
    if let Some(queue_owner_widget_instance_id) = queue_owner_widget_instance_id {
        let Some(widget) = store.get_widget_instance(queue_owner_widget_instance_id)? else {
            return Err(storage_invalid_input(format!(
                "queue local executor owner not found: {queue_owner_widget_instance_id}"
            )));
        };

        if widget.workspace_id != workspace_id {
            return Err(storage_invalid_input(format!(
                "queue local executor owner does not belong to workspace: {queue_owner_widget_instance_id}"
            )));
        }

        if widget.definition_id != AGENT_QUEUE_WIDGET_DEFINITION_ID {
            return Err(storage_invalid_input(format!(
                "queue local executor owner is not an Agent Queue widget: {queue_owner_widget_instance_id}"
            )));
        }

        return Ok(widget);
    }

    let Some(assigned_executor_widget_id) = assigned_executor_widget_id else {
        return Err(storage_invalid_input(
            "queue task needs a Queue-owned local executor before running".to_owned(),
        ));
    };

    load_agent_executor_widget(store, workspace_id, assigned_executor_widget_id)
}

fn load_agent_queue_direct_work_owner_by_id(
    store: &hobit_storage_sqlite::SqliteStore,
    workspace_id: &str,
    widget_instance_id: &str,
) -> Result<hobit_storage_sqlite::WidgetInstanceRow, hobit_storage_sqlite::StorageError> {
    let Some(widget) = store.get_widget_instance(widget_instance_id)? else {
        return Err(storage_invalid_input(format!(
            "queue local executor owner not found: {widget_instance_id}"
        )));
    };

    if widget.workspace_id != workspace_id {
        return Err(storage_invalid_input(format!(
            "queue local executor owner does not belong to workspace: {widget_instance_id}"
        )));
    }

    if widget.definition_id != AGENT_QUEUE_WIDGET_DEFINITION_ID
        && widget.definition_id != AGENT_RUN_WIDGET_DEFINITION_ID
    {
        return Err(storage_invalid_input(format!(
            "queue local executor owner is not a Direct Work owner: {widget_instance_id}"
        )));
    }

    Ok(widget)
}

fn is_runnable_agent_queue_task_status(status: &str) -> bool {
    AgentQueueTaskLifecycleStatus::from_current_status(status)
        .map(AgentQueueTaskLifecycleStatus::allows_explicit_assigned_start)
        .unwrap_or(false)
}

fn build_direct_work_input(
    input: &NormalizedStartAssignedAgentQueueTaskInput,
    workbench_id: String,
    widget_instance_id: String,
    operator_prompt: String,
) -> Result<RunCodexDirectWorkInput, WorkspaceServiceError> {
    let direct_work_input = RunCodexDirectWorkInput {
        workspace_id: input.workspace_id.clone(),
        workbench_id,
        widget_instance_id,
        codex_executable: input.codex_executable.clone(),
        repo_root: input.repo_root.clone(),
        operator_prompt,
        codex_thread_id: None,
        sandbox: input.sandbox.clone(),
        approval_policy: input.approval_policy.clone(),
        skip_git_repo_check: true,
        timeout_ms: input.timeout_ms,
        stdout_cap_bytes: input.stdout_cap_bytes,
        stderr_cap_bytes: input.stderr_cap_bytes,
    };
    normalize_direct_work_input(direct_work_input.clone())?;
    Ok(direct_work_input)
}

enum StartTransactionResult {
    Started(AssignedAgentQueueTaskStartSummary),
    Blocked(QueueWorkerStartBlocker),
}

fn resolve_existing_workflow_start(
    store: &hobit_storage_sqlite::SqliteStore,
    input: &NormalizedStartAssignedAgentQueueTaskInput,
    context: &NormalizedQueueWorkerStartContext,
) -> Result<Option<StartTransactionResult>, hobit_storage_sqlite::StorageError> {
    let Some(existing) = store.get_agent_queue_workflow_action_by_idempotency_key(
        &context.workflow_run_id,
        &context.action_idempotency_key,
    )?
    else {
        return Ok(None);
    };

    let target_refs_json = workflow_start_target_refs_json(context);
    if !workflow_start_action_matches_target(&existing, &input.workspace_id, &target_refs_json) {
        return Ok(Some(StartTransactionResult::Blocked(
            workflow_start_blocker_with_workflow_refs(
                workflow_start_blocker(
                    "workflow_action_idempotency_conflict",
                    "A Queue worker start action already exists for this idempotency key with different explicit refs.",
                    Some(&input.queue_item_id),
                    Some(&context.executor_widget_id),
                    workflow_action_result_run_id(&existing).as_deref(),
                    None,
                    context.expected_queue_control_version,
                    None,
                    Some("action_idempotency_key"),
                ),
                context,
            ),
        )));
    }

    let run_id = workflow_action_result_run_id(&existing);
    match existing.status.as_str() {
        "completed" => {
            let Some(run_id) = run_id else {
                return record_workflow_start_blocked(
                    store,
                    input,
                    context,
                    workflow_start_blocker(
                        "orphaned_start",
                        "workflow worker start action completed without a recorded runId.",
                        Some(&input.queue_item_id),
                        Some(&context.executor_widget_id),
                        None,
                        None,
                        context.expected_queue_control_version,
                        None,
                        None,
                    ),
                )
                .map(Some);
            };
            let current_run_state = current_start_run_state(store, &input.workspace_id, &run_id)?;
            let Some(current_run_state) = current_run_state else {
                return record_workflow_start_blocked(
                    store,
                    input,
                    context,
                    workflow_start_blocker(
                        "start_state_unknown",
                        "workflow worker start has a runId, but the run link/runtime state could not be verified; operator review is required before retry.",
                        Some(&input.queue_item_id),
                        Some(&context.executor_widget_id),
                        Some(&run_id),
                        None,
                        context.expected_queue_control_version,
                        None,
                        None,
                    ),
                )
                .map(Some);
            };

            return workflow_start_existing_summary(
                store,
                input,
                context,
                run_id,
                current_run_state,
            )
            .map(StartTransactionResult::Started)
            .map(Some);
        }
        "blocked" | "failed" | "cancelled" => {
            return Ok(Some(StartTransactionResult::Blocked(
                workflow_start_blocker_with_workflow_refs(
                    workflow_start_blocker(
                        existing
                            .blocker_code
                            .as_deref()
                            .unwrap_or("workflow_start_blocked"),
                        existing.blocker_message.as_deref().unwrap_or(
                            "workflow worker start action is already blocked or terminal.",
                        ),
                        Some(&input.queue_item_id),
                        Some(&context.executor_widget_id),
                        run_id.as_deref(),
                        Some(existing.status.as_str()),
                        context.expected_queue_control_version,
                        None,
                        None,
                    ),
                    context,
                ),
            )));
        }
        _ => {
            return record_workflow_start_blocked(
                store,
                input,
                context,
                workflow_start_blocker(
                    if run_id.is_some() {
                        "orphaned_start"
                    } else {
                        "start_state_unknown"
                    },
                    "workflow worker start action is incomplete; retry is blocked to avoid a duplicate worker.",
                    Some(&input.queue_item_id),
                    Some(&context.executor_widget_id),
                    run_id.as_deref(),
                    Some(existing.status.as_str()),
                    context.expected_queue_control_version,
                    None,
                    None,
                ),
            )
            .map(Some);
        }
    }
}

fn workflow_start_existing_summary(
    store: &hobit_storage_sqlite::SqliteStore,
    input: &NormalizedStartAssignedAgentQueueTaskInput,
    context: &NormalizedQueueWorkerStartContext,
    run_id: String,
    current_run_state: String,
) -> Result<AssignedAgentQueueTaskStartSummary, hobit_storage_sqlite::StorageError> {
    let task = load_agent_queue_task(store, &input.workspace_id, &input.queue_item_id)?;
    let executor = load_agent_queue_direct_work_owner_by_id(
        store,
        &input.workspace_id,
        &context.executor_widget_id,
    )?;
    let direct_work_input = build_direct_work_input(
        input,
        executor.workbench_id.clone(),
        executor.id.clone(),
        operator_prompt_for_queue_task(&task)
            .map_err(|error| storage_invalid_input(error.to_string()))?,
    )
    .map_err(|error| storage_invalid_input(error.to_string()))?;

    Ok(AssignedAgentQueueTaskStartSummary {
        workspace_id: task.workspace_id,
        queue_item_id: task.queue_item_id,
        workbench_id: executor.workbench_id,
        executor_widget_instance_id: executor.id,
        run_id,
        status: QUEUE_WORKER_START_STATUS_ALREADY_STARTED.to_owned(),
        direct_work_input,
        workflow_run_id: Some(context.workflow_run_id.clone()),
        workflow_action_id: context.workflow_action_id.clone(),
        action_idempotency_key: Some(context.action_idempotency_key.clone()),
        settings_hash: Some(context.settings_hash.clone()),
        current_run_state: Some(current_run_state),
        blocker: None,
    })
}

fn record_workflow_start_blocked(
    store: &hobit_storage_sqlite::SqliteStore,
    input: &NormalizedStartAssignedAgentQueueTaskInput,
    context: &NormalizedQueueWorkerStartContext,
    blocker: QueueWorkerStartBlocker,
) -> Result<StartTransactionResult, hobit_storage_sqlite::StorageError> {
    let blocker = workflow_start_blocker_with_workflow_refs(blocker, context);
    let target_refs_json = workflow_start_target_refs_json(context);
    let now = placeholder_timestamp();

    if let Some(existing) = store.get_agent_queue_workflow_action_by_idempotency_key(
        &context.workflow_run_id,
        &context.action_idempotency_key,
    )? {
        if workflow_start_action_matches_target(&existing, &input.workspace_id, &target_refs_json) {
            store.update_agent_queue_workflow_action(
                &input.workspace_id,
                &context.workflow_run_id,
                &context.action_idempotency_key,
                AgentQueueWorkflowActionUpdate {
                    status: QueueWorkflowActionStatus::Blocked.as_str(),
                    result_refs_json: None,
                    blocker_code: Some(&blocker.blocker_code),
                    blocker_message: Some(&blocker.blocker_message),
                    attempt_count: Some(existing.attempt_count.max(1)),
                    started_at: existing.started_at.as_deref().or(Some(now.as_str())),
                    completed_at: Some(&now),
                    updated_at: Some(&now),
                },
            )?;
        }
        return Ok(StartTransactionResult::Blocked(blocker));
    }

    let generated_action_id;
    let action_id = if let Some(action_id) = context.workflow_action_id.as_deref() {
        action_id
    } else {
        generated_action_id = placeholder_id("queue-workflow-action-");
        generated_action_id.as_str()
    };
    store.insert_agent_queue_workflow_action(NewAgentQueueWorkflowAction {
        action_id,
        workflow_run_id: &context.workflow_run_id,
        workspace_id: &input.workspace_id,
        step_id: QUEUE_WORKER_START_STEP_ID,
        action_type: QUEUE_WORKER_START_ACTION_TYPE,
        idempotency_key: &context.action_idempotency_key,
        status: QueueWorkflowActionStatus::Blocked.as_str(),
        target_refs_json: Some(&target_refs_json),
        result_refs_json: None,
        blocker_code: Some(&blocker.blocker_code),
        blocker_message: Some(&blocker.blocker_message),
        attempt_count: 1,
        started_at: Some(&now),
        completed_at: Some(&now),
        created_at: Some(&now),
        updated_at: Some(&now),
    })?;
    Ok(StartTransactionResult::Blocked(blocker))
}

fn insert_workflow_start_action(
    store: &hobit_storage_sqlite::SqliteStore,
    context: &NormalizedQueueWorkerStartContext,
    workspace_id: &str,
    target_refs_json: &str,
    now: &str,
) -> Result<AgentQueueWorkflowActionRow, hobit_storage_sqlite::StorageError> {
    let generated_action_id;
    let action_id = if let Some(action_id) = context.workflow_action_id.as_deref() {
        action_id
    } else {
        generated_action_id = placeholder_id("queue-workflow-action-");
        generated_action_id.as_str()
    };
    store.insert_agent_queue_workflow_action(NewAgentQueueWorkflowAction {
        action_id,
        workflow_run_id: &context.workflow_run_id,
        workspace_id,
        step_id: QUEUE_WORKER_START_STEP_ID,
        action_type: QUEUE_WORKER_START_ACTION_TYPE,
        idempotency_key: &context.action_idempotency_key,
        status: QueueWorkflowActionStatus::Running.as_str(),
        target_refs_json: Some(target_refs_json),
        result_refs_json: None,
        blocker_code: None,
        blocker_message: None,
        attempt_count: 1,
        started_at: Some(now),
        completed_at: None,
        created_at: Some(now),
        updated_at: Some(now),
    })
}

fn workflow_start_action_matches_target(
    action: &AgentQueueWorkflowActionRow,
    workspace_id: &str,
    target_refs_json: &str,
) -> bool {
    action.workspace_id == workspace_id
        && action.step_id == QUEUE_WORKER_START_STEP_ID
        && action.action_type == QUEUE_WORKER_START_ACTION_TYPE
        && action.target_refs_json.as_deref() == Some(target_refs_json)
}

fn workflow_start_target_refs_json(context: &NormalizedQueueWorkerStartContext) -> String {
    let mut refs = Map::new();
    refs.insert(
        "executorWidgetId".to_owned(),
        Value::String(context.executor_widget_id.clone()),
    );
    refs.insert(
        "settingsHash".to_owned(),
        Value::String(context.settings_hash.clone()),
    );
    refs.insert("taskId".to_owned(), Value::String(context.task_id.clone()));
    refs.insert(
        "workflowActionId".to_owned(),
        context
            .workflow_action_id
            .clone()
            .map(Value::String)
            .unwrap_or(Value::Null),
    );
    refs.insert(
        "workflowRunId".to_owned(),
        Value::String(context.workflow_run_id.clone()),
    );
    Value::Object(refs).to_string()
}

fn workflow_start_result_refs_json(run_id: &str, current_run_state: &str) -> String {
    let mut refs = Map::new();
    refs.insert(
        "currentRunState".to_owned(),
        Value::String(current_run_state.to_owned()),
    );
    refs.insert("runId".to_owned(), Value::String(run_id.to_owned()));
    Value::Object(refs).to_string()
}

fn workflow_action_result_run_id(action: &AgentQueueWorkflowActionRow) -> Option<String> {
    action
        .result_refs_json
        .as_deref()
        .and_then(|json| serde_json::from_str::<Value>(json).ok())
        .and_then(|value| {
            value
                .get("runId")
                .and_then(Value::as_str)
                .map(str::to_owned)
        })
}

fn current_start_run_state(
    store: &hobit_storage_sqlite::SqliteStore,
    workspace_id: &str,
    run_id: &str,
) -> Result<Option<String>, hobit_storage_sqlite::StorageError> {
    if let Some(link) = store.get_agent_queue_task_run_link_by_run_id(workspace_id, run_id)? {
        return Ok(Some(link.status));
    }
    Ok(store.get_widget_run(run_id)?.map(|run| run.status))
}

fn latest_active_task_run_link(
    store: &hobit_storage_sqlite::SqliteStore,
    workspace_id: &str,
    queue_item_id: &str,
) -> Result<Option<AgentQueueTaskRunLinkRow>, hobit_storage_sqlite::StorageError> {
    let link = store.get_latest_agent_queue_task_run_link(workspace_id, queue_item_id)?;
    Ok(link.filter(|link| link.status == AgentQueueTaskRunStatus::Running.as_str()))
}

enum StartTaskReadiness {
    Runnable(hobit_storage_sqlite::AgentQueueTaskRow),
    Blocked(StartTransactionResult),
}

fn load_workflow_start_runnable_task(
    store: &hobit_storage_sqlite::SqliteStore,
    input: &NormalizedStartAssignedAgentQueueTaskInput,
    context: &NormalizedQueueWorkerStartContext,
) -> Result<StartTaskReadiness, hobit_storage_sqlite::StorageError> {
    let task = load_agent_queue_task(store, &input.workspace_id, &input.queue_item_id)?;
    if !is_runnable_agent_queue_task_status(&task.status) {
        if let Some(active_link) =
            latest_active_task_run_link(store, &input.workspace_id, &input.queue_item_id)?
        {
            return record_workflow_start_blocked(
                store,
                input,
                context,
                workflow_start_blocker(
                    "active_run_conflict",
                    "queue task already has an active run that is not owned by this workflow start action.",
                    Some(&input.queue_item_id),
                    Some(&active_link.executor_widget_id),
                    Some(&active_link.direct_work_run_id),
                    Some(active_link.status.as_str()),
                    context.expected_queue_control_version,
                    None,
                    None,
                ),
            )
            .map(StartTaskReadiness::Blocked);
        }
        return record_workflow_start_blocked(
            store,
            input,
            context,
            workflow_start_blocker(
                "task_not_ready",
                format!("queue task status cannot be run: {}", task.status),
                Some(&input.queue_item_id),
                Some(&context.executor_widget_id),
                None,
                Some(task.status.as_str()),
                context.expected_queue_control_version,
                None,
                Some("task_status"),
            ),
        )
        .map(StartTaskReadiness::Blocked);
    }

    if task.prompt.trim().is_empty() {
        return record_workflow_start_blocked(
            store,
            input,
            context,
            workflow_start_blocker(
                "task_not_ready",
                "queue task prompt must not be empty before running",
                Some(&input.queue_item_id),
                Some(&context.executor_widget_id),
                None,
                Some(task.status.as_str()),
                context.expected_queue_control_version,
                None,
                Some("prompt"),
            ),
        )
        .map(StartTaskReadiness::Blocked);
    }

    Ok(StartTaskReadiness::Runnable(task))
}

fn validate_queue_task_dependencies_ready(
    store: &hobit_storage_sqlite::SqliteStore,
    workspace_id: &str,
    task: &hobit_storage_sqlite::AgentQueueTaskRow,
) -> Result<(), QueueWorkerStartBlocker> {
    let dependency_ids = queue_task_dependency_ids(task);
    for dependency_id in dependency_ids {
        let upstream = store
            .get_agent_queue_task(workspace_id, &dependency_id)
            .map_err(|error| {
                workflow_start_blocker(
                    "dependency_unknown",
                    format!("queue task dependency state could not be read: {error}"),
                    Some(&task.queue_item_id),
                    None,
                    None,
                    None,
                    None,
                    None,
                    None,
                )
            })?
            .ok_or_else(|| {
                workflow_start_blocker(
                    "dependency_unknown",
                    format!("queue task dependency not found in workspace: {dependency_id}"),
                    Some(&task.queue_item_id),
                    None,
                    None,
                    None,
                    None,
                    None,
                    None,
                )
            })?;
        if store
            .get_latest_agent_queue_completion_decision(workspace_id, &dependency_id)
            .map_err(|error| {
                workflow_start_blocker(
                    "dependency_unknown",
                    format!("queue task dependency completion state could not be read: {error}"),
                    Some(&task.queue_item_id),
                    None,
                    None,
                    None,
                    None,
                    None,
                    None,
                )
            })?
            .is_some()
        {
            continue;
        }
        if store
            .get_latest_agent_queue_failure_decision(workspace_id, &dependency_id)
            .map_err(|error| {
                workflow_start_blocker(
                    "dependency_unknown",
                    format!("queue task dependency failure state could not be read: {error}"),
                    Some(&task.queue_item_id),
                    None,
                    None,
                    None,
                    None,
                    None,
                    None,
                )
            })?
            .is_some()
            || upstream.status == "cancelled"
        {
            return Err(workflow_start_blocker(
                "dependency_failed",
                "At least one dependency failed before accepted completion.",
                Some(&task.queue_item_id),
                None,
                None,
                Some(upstream.status.as_str()),
                None,
                None,
                None,
            ));
        }
        if upstream.status == "blocked" {
            return Err(workflow_start_blocker(
                "dependency_blocked",
                "At least one dependency is blocked.",
                Some(&task.queue_item_id),
                None,
                None,
                Some(upstream.status.as_str()),
                None,
                None,
                None,
            ));
        }
        return Err(workflow_start_blocker(
            "dependency_waiting",
            "At least one dependency has not reached accepted completion.",
            Some(&task.queue_item_id),
            None,
            None,
            Some(upstream.status.as_str()),
            None,
            None,
            None,
        ));
    }

    Ok(())
}

fn queue_task_dependency_ids(task: &hobit_storage_sqlite::AgentQueueTaskRow) -> Vec<String> {
    serde_json::from_str::<Vec<String>>(&task.depends_on).unwrap_or_default()
}

fn effective_worker_start_settings(
    input: &NormalizedStartAssignedAgentQueueTaskInput,
    task: &hobit_storage_sqlite::AgentQueueTaskRow,
    executor_widget_id: &str,
) -> QueueWorkerStartSettingsSnapshot {
    QueueWorkerStartSettingsSnapshot {
        execution_workspace: task
            .execution_workspace
            .clone()
            .unwrap_or_else(|| input.repo_root.to_string_lossy().into_owned()),
        codex_executable: task
            .codex_executable
            .clone()
            .unwrap_or_else(|| input.codex_executable.clone()),
        sandbox: task
            .sandbox
            .clone()
            .unwrap_or_else(|| input.sandbox.clone()),
        approval_policy: task
            .approval_policy
            .clone()
            .unwrap_or_else(|| input.approval_policy.clone()),
        executor_widget_id: executor_widget_id.to_owned(),
    }
}

fn validate_workflow_start_run_settings(
    input: &NormalizedStartAssignedAgentQueueTaskInput,
    task: &hobit_storage_sqlite::AgentQueueTaskRow,
    context: &NormalizedQueueWorkerStartContext,
    actual_settings_hash: &str,
) -> Option<QueueWorkerStartBlocker> {
    if context.settings_hash != actual_settings_hash {
        let mut blocker = workflow_start_blocker(
            "settings_hash_mismatch",
            "workflow worker start settingsHash does not match durable task run settings.",
            Some(&input.queue_item_id),
            Some(&context.executor_widget_id),
            None,
            None,
            context.expected_queue_control_version,
            None,
            Some("settings_hash"),
        );
        blocker.expected_settings_hash = Some(context.settings_hash.clone());
        blocker.actual_settings_hash = Some(actual_settings_hash.to_owned());
        return Some(blocker);
    }

    let repo_root = input.repo_root.to_string_lossy();
    for (field, expected, actual) in [
        (
            "execution_workspace",
            task.execution_workspace.as_deref(),
            Some(repo_root.as_ref()),
        ),
        (
            "codex_executable",
            task.codex_executable.as_deref(),
            Some(input.codex_executable.as_str()),
        ),
        (
            "sandbox",
            task.sandbox.as_deref(),
            Some(input.sandbox.as_str()),
        ),
        (
            "approval_policy",
            task.approval_policy.as_deref(),
            Some(input.approval_policy.as_str()),
        ),
    ] {
        if let Some(expected) = expected {
            if actual != Some(expected) {
                let mut blocker = workflow_start_blocker(
                    "run_settings_mismatch",
                    format!(
                        "workflow worker start {field} does not match durable task run settings."
                    ),
                    Some(&input.queue_item_id),
                    Some(&context.executor_widget_id),
                    None,
                    None,
                    context.expected_queue_control_version,
                    None,
                    Some(field),
                );
                blocker.expected_settings_hash = Some(context.settings_hash.clone());
                blocker.actual_settings_hash = Some(actual_settings_hash.to_owned());
                return Some(blocker);
            }
        }
    }

    None
}

fn workflow_start_blocker(
    blocker_code: &str,
    blocker_message: impl Into<String>,
    task_id: Option<&str>,
    executor_widget_id: Option<&str>,
    run_id: Option<&str>,
    current_run_state: Option<&str>,
    expected_queue_control_version: Option<i64>,
    actual_queue_control_version: Option<i64>,
    missing_required_field: Option<&str>,
) -> QueueWorkerStartBlocker {
    QueueWorkerStartBlocker {
        blocker_code: blocker_code.to_owned(),
        blocker_message: blocker_message.into(),
        task_id: task_id.map(str::to_owned),
        executor_widget_id: executor_widget_id.map(str::to_owned),
        run_id: run_id.map(str::to_owned),
        workflow_run_id: None,
        workflow_action_id: None,
        action_idempotency_key: None,
        current_run_state: current_run_state.map(str::to_owned),
        expected_queue_control_version,
        actual_queue_control_version,
        expected_settings_hash: None,
        actual_settings_hash: None,
        missing_required_field: missing_required_field.map(str::to_owned),
    }
}

fn workflow_start_blocker_with_workflow_refs(
    mut blocker: QueueWorkerStartBlocker,
    context: &NormalizedQueueWorkerStartContext,
) -> QueueWorkerStartBlocker {
    blocker.workflow_run_id = Some(context.workflow_run_id.clone());
    blocker.workflow_action_id = context.workflow_action_id.clone();
    blocker.action_idempotency_key = Some(context.action_idempotency_key.clone());
    if blocker.task_id.is_none() {
        blocker.task_id = Some(context.task_id.clone());
    }
    if blocker.executor_widget_id.is_none() {
        blocker.executor_widget_id = Some(context.executor_widget_id.clone());
    }
    if blocker.expected_settings_hash.is_none() {
        blocker.expected_settings_hash = Some(context.settings_hash.clone());
    }
    blocker
}

fn workflow_start_storage_error(
    blocker: QueueWorkerStartBlocker,
) -> hobit_storage_sqlite::StorageError {
    storage_invalid_input(workflow_start_blocker_message(&blocker))
}

fn workflow_start_blocker_message(blocker: &QueueWorkerStartBlocker) -> String {
    format!("{}: {}", blocker.blocker_code, blocker.blocker_message)
}

fn map_direct_work_status_to_queue_status(
    direct_work_status: &str,
) -> Result<&'static str, WorkspaceServiceError> {
    map_direct_work_final_status_to_queue_status(direct_work_status).map(|status| status.as_str())
}
