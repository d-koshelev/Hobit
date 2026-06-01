use crate::WorkspaceServiceError;

use super::{
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
    placeholder_timestamp,
    validation::{required_input, validate_widget_run_ownership},
    AgentQueueTaskRunSource, AgentQueueTaskSummary, AssignedAgentQueueTaskRunPlan,
    AssignedAgentQueueTaskStartSummary, FinishAssignedAgentQueueTaskRunInput,
    RunCodexDirectWorkInput, StartAssignedAgentQueueTaskInput, WorkspaceService,
    AGENT_QUEUE_WIDGET_DEFINITION_ID, AGENT_RUN_WIDGET_DEFINITION_ID,
};

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
            task.prompt,
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

        self.store
            .with_immediate_transaction(|store| {
                let task = load_runnable_agent_queue_task(
                    store,
                    &input.workspace_id,
                    &input.queue_item_id,
                )?;
                let executor = load_agent_queue_direct_work_owner(
                    store,
                    &input.workspace_id,
                    input.queue_owner_widget_instance_id.as_deref(),
                    task.assigned_executor_widget_id.as_deref(),
                )?;
                let direct_work_input = build_direct_work_input(
                    &input,
                    executor.workbench_id.clone(),
                    executor.id.clone(),
                    task.prompt.clone(),
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

                Ok(AssignedAgentQueueTaskStartSummary {
                    workspace_id: task.workspace_id,
                    queue_item_id: task.queue_item_id,
                    workbench_id: executor.workbench_id,
                    executor_widget_instance_id: executor.id,
                    run_id: start.run_id,
                    status: AgentQueueExecutionLifecycleStatus::Started
                        .as_str()
                        .to_owned(),
                    direct_work_input,
                })
            })
            .map_err(map_storage_agent_queue_task_error)
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
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedFinishAssignedAgentQueueTaskRunInput {
    workspace_id: String,
    queue_item_id: String,
    executor_widget_instance_id: String,
    run_id: String,
    direct_work_status: String,
}

fn normalize_start_assigned_agent_queue_task_input(
    input: StartAssignedAgentQueueTaskInput,
) -> Result<NormalizedStartAssignedAgentQueueTaskInput, WorkspaceServiceError> {
    if input.repo_root.as_os_str().is_empty() {
        return Err(WorkspaceServiceError::InvalidInput(
            "repo root must not be empty".to_owned(),
        ));
    }

    Ok(NormalizedStartAssignedAgentQueueTaskInput {
        workspace_id: required_input(&input.workspace_id, "workspace id")?.to_owned(),
        queue_item_id: required_input(&input.queue_item_id, "queue item id")?.to_owned(),
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
    })
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
        skip_git_repo_check: false,
        timeout_ms: input.timeout_ms,
        stdout_cap_bytes: input.stdout_cap_bytes,
        stderr_cap_bytes: input.stderr_cap_bytes,
    };
    normalize_direct_work_input(direct_work_input.clone())?;
    Ok(direct_work_input)
}

fn map_direct_work_status_to_queue_status(
    direct_work_status: &str,
) -> Result<&'static str, WorkspaceServiceError> {
    map_direct_work_final_status_to_queue_status(direct_work_status).map(|status| status.as_str())
}
