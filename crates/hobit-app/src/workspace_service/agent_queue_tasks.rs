use hobit_storage_sqlite::{
    AgentQueueTaskRow, AgentQueueTaskUpdate, NewAgentQueueTask, WidgetInstanceRow,
};

use crate::WorkspaceServiceError;

use super::{
    agent_queue_lifecycle::{AgentQueueTaskExecutionPolicy, AgentQueueTaskLifecycleStatus},
    agent_queue_task_dependencies::{
        dependencies_json, normalize_optional_dependency_ids, validate_create_dependencies,
        validate_dependency_update,
    },
    mapping::agent_queue_task_summary,
    placeholder_id, placeholder_timestamp,
    validation::required_input,
    AgentQueueTaskSummary, AssignAgentQueueTaskToExecutorInput, ClearAgentQueueTaskAssignmentInput,
    CreateAgentQueueTaskInput, DeleteAgentQueueTaskInput, UpdateAgentQueueTaskInput,
    WorkspaceService, AGENT_RUN_WIDGET_DEFINITION_ID,
};

const MIN_AGENT_QUEUE_TASK_PRIORITY: i64 = 0;
const MAX_AGENT_QUEUE_TASK_PRIORITY: i64 = 5;

impl WorkspaceService {
    pub fn create_agent_queue_task(
        &self,
        input: CreateAgentQueueTaskInput,
    ) -> Result<AgentQueueTaskSummary, WorkspaceServiceError> {
        let input = normalize_create_agent_queue_task_input(input)?;
        let queue_item_id = placeholder_id("queue_task_");
        let created_at = placeholder_timestamp();

        let task = self
            .store
            .with_immediate_transaction(|store| {
                if store.get_workspace(&input.workspace_id)?.is_none() {
                    return Err(hobit_storage_sqlite::StorageError::InvalidParameterName(
                        format!("workspace not found: {}", input.workspace_id),
                    ));
                }

                validate_create_dependencies(store, &input.workspace_id, &input.depends_on)?;
                let depends_on_json = dependencies_json(&input.depends_on)?;
                let task = store.create_agent_queue_task(NewAgentQueueTask {
                    queue_item_id: &queue_item_id,
                    workspace_id: &input.workspace_id,
                    title: &input.title,
                    description: &input.description,
                    prompt: &input.prompt,
                    status: &input.status,
                    priority: input.priority,
                    depends_on: Some(&depends_on_json),
                    execution_policy: Some(&input.execution_policy),
                    execution_workspace: input.execution_workspace.as_deref(),
                    codex_executable: input.codex_executable.as_deref(),
                    sandbox: input.sandbox.as_deref(),
                    approval_policy: input.approval_policy.as_deref(),
                    context_json: None,
                    created_at: Some(&created_at),
                    updated_at: Some(&created_at),
                })?;
                store.touch_workspace(&input.workspace_id)?;
                Ok(task)
            })
            .map_err(map_storage_agent_queue_task_error)?;

        Ok(agent_queue_task_summary(task))
    }

    pub fn list_agent_queue_tasks(
        &self,
        workspace_id: &str,
    ) -> Result<Vec<AgentQueueTaskSummary>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;

        if self.store.get_workspace(workspace_id)?.is_none() {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "workspace not found: {workspace_id}"
            )));
        }

        Ok(self
            .store
            .list_agent_queue_tasks(workspace_id)?
            .into_iter()
            .map(agent_queue_task_summary)
            .collect())
    }

    pub fn get_agent_queue_task(
        &self,
        workspace_id: &str,
        queue_item_id: &str,
    ) -> Result<Option<AgentQueueTaskSummary>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let queue_item_id = required_input(queue_item_id, "queue item id")?;

        self.validate_agent_queue_task_workspace_access(workspace_id, queue_item_id)?;
        Ok(self
            .store
            .get_agent_queue_task(workspace_id, queue_item_id)?
            .map(agent_queue_task_summary))
    }

    pub fn update_agent_queue_task(
        &self,
        input: UpdateAgentQueueTaskInput,
    ) -> Result<Option<AgentQueueTaskSummary>, WorkspaceServiceError> {
        let input = normalize_update_agent_queue_task_input(input)?;
        self.validate_agent_queue_task_workspace_access(&input.workspace_id, &input.queue_item_id)?;

        let updated_at = placeholder_timestamp();
        let task = self.store.with_immediate_transaction(|store| {
            validate_dependency_update(
                store,
                &input.workspace_id,
                &input.queue_item_id,
                input.depends_on.as_deref(),
            )?;
            let depends_on_json = input
                .depends_on
                .as_ref()
                .map(|dependency_ids| dependencies_json(dependency_ids))
                .transpose()?;
            let task = store.update_agent_queue_task(
                &input.workspace_id,
                &input.queue_item_id,
                AgentQueueTaskUpdate {
                    title: &input.title,
                    description: &input.description,
                    prompt: &input.prompt,
                    status: &input.status,
                    priority: input.priority,
                    depends_on: depends_on_json.as_deref(),
                    execution_policy: input.execution_policy.as_deref(),
                    execution_workspace: input.execution_workspace.as_deref(),
                    codex_executable: input.codex_executable.as_deref(),
                    sandbox: input.sandbox.as_deref(),
                    approval_policy: input.approval_policy.as_deref(),
                    context_json: None,
                    updated_at: Some(&updated_at),
                },
            )?;
            if task.is_some() {
                store.touch_workspace(&input.workspace_id)?;
            }
            Ok(task)
        })?;

        Ok(task.map(agent_queue_task_summary))
    }

    pub fn assign_agent_queue_task_to_executor(
        &self,
        input: AssignAgentQueueTaskToExecutorInput,
    ) -> Result<AgentQueueTaskSummary, WorkspaceServiceError> {
        let input = normalize_assign_agent_queue_task_input(input)?;
        let updated_at = placeholder_timestamp();
        let task = self
            .store
            .with_immediate_transaction(|store| {
                let task = load_assignable_agent_queue_task(
                    store,
                    &input.workspace_id,
                    &input.queue_item_id,
                )?;
                let executor = load_agent_executor_widget(
                    store,
                    &input.workspace_id,
                    &input.executor_widget_instance_id,
                )?;
                let task = store
                    .assign_agent_queue_task_to_executor(
                        &input.workspace_id,
                        &task.queue_item_id,
                        &executor.id,
                        Some(&updated_at),
                    )?
                    .ok_or(hobit_storage_sqlite::StorageError::QueryReturnedNoRows)?;
                store.touch_workspace(&input.workspace_id)?;
                Ok(task)
            })
            .map_err(map_storage_agent_queue_task_error)?;

        Ok(agent_queue_task_summary(task))
    }

    pub fn clear_agent_queue_task_assignment(
        &self,
        input: ClearAgentQueueTaskAssignmentInput,
    ) -> Result<AgentQueueTaskSummary, WorkspaceServiceError> {
        let input = normalize_clear_agent_queue_task_assignment_input(input)?;
        let updated_at = placeholder_timestamp();
        let task = self
            .store
            .with_immediate_transaction(|store| {
                let task = load_clearable_agent_queue_task(
                    store,
                    &input.workspace_id,
                    &input.queue_item_id,
                )?;
                let task = store
                    .clear_agent_queue_task_assignment(
                        &input.workspace_id,
                        &task.queue_item_id,
                        Some(&updated_at),
                    )?
                    .ok_or(hobit_storage_sqlite::StorageError::QueryReturnedNoRows)?;
                store.touch_workspace(&input.workspace_id)?;
                Ok(task)
            })
            .map_err(map_storage_agent_queue_task_error)?;

        Ok(agent_queue_task_summary(task))
    }

    pub fn delete_agent_queue_task(
        &self,
        input: DeleteAgentQueueTaskInput,
    ) -> Result<bool, WorkspaceServiceError> {
        let input = normalize_delete_agent_queue_task_input(input)?;
        let deleted = self
            .store
            .with_immediate_transaction(|store| {
                let Some(task) = load_optional_agent_queue_task(
                    store,
                    &input.workspace_id,
                    &input.queue_item_id,
                )?
                else {
                    return Ok(false);
                };

                if !AgentQueueTaskLifecycleStatus::from_current_status(&task.status)
                    .map(AgentQueueTaskLifecycleStatus::allows_deletion)
                    .unwrap_or(false)
                {
                    return Err(storage_invalid_input(
                        "queue task cannot be deleted while status is running".to_owned(),
                    ));
                }

                let deleted =
                    store.delete_agent_queue_task(&input.workspace_id, &input.queue_item_id)?;
                if deleted {
                    store.touch_workspace(&input.workspace_id)?;
                }
                Ok(deleted)
            })
            .map_err(map_storage_agent_queue_task_error)?;

        Ok(deleted)
    }

    fn validate_agent_queue_task_workspace_access(
        &self,
        workspace_id: &str,
        queue_item_id: &str,
    ) -> Result<(), WorkspaceServiceError> {
        if self.store.get_workspace(workspace_id)?.is_none() {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "workspace not found: {workspace_id}"
            )));
        }

        let Some(task) = self.store.get_agent_queue_task_by_id(queue_item_id)? else {
            return Ok(());
        };

        if task.workspace_id != workspace_id {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "queue task does not belong to workspace: {queue_item_id}"
            )));
        }

        Ok(())
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedCreateAgentQueueTaskInput {
    workspace_id: String,
    title: String,
    description: String,
    prompt: String,
    status: String,
    priority: i64,
    depends_on: Vec<String>,
    execution_policy: String,
    execution_workspace: Option<String>,
    codex_executable: Option<String>,
    sandbox: Option<String>,
    approval_policy: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedUpdateAgentQueueTaskInput {
    workspace_id: String,
    queue_item_id: String,
    title: String,
    description: String,
    prompt: String,
    status: String,
    priority: i64,
    depends_on: Option<Vec<String>>,
    execution_policy: Option<String>,
    execution_workspace: Option<String>,
    codex_executable: Option<String>,
    sandbox: Option<String>,
    approval_policy: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedAssignAgentQueueTaskInput {
    workspace_id: String,
    queue_item_id: String,
    executor_widget_instance_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedClearAgentQueueTaskAssignmentInput {
    workspace_id: String,
    queue_item_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedDeleteAgentQueueTaskInput {
    workspace_id: String,
    queue_item_id: String,
}

fn normalize_create_agent_queue_task_input(
    input: CreateAgentQueueTaskInput,
) -> Result<NormalizedCreateAgentQueueTaskInput, WorkspaceServiceError> {
    let status = normalize_status(input.status)?;
    let prompt = normalize_prompt(input.prompt, &status)?;
    Ok(NormalizedCreateAgentQueueTaskInput {
        workspace_id: required_owned(input.workspace_id, "workspace id")?,
        title: required_owned(input.title, "queue task title")?,
        description: input.description.trim().to_owned(),
        prompt,
        status,
        priority: normalize_priority(input.priority)?,
        depends_on: normalize_optional_dependency_ids(input.depends_on)?.unwrap_or_default(),
        execution_policy: normalize_execution_policy(input.execution_policy)?,
        execution_workspace: normalize_optional_trimmed(input.execution_workspace),
        codex_executable: normalize_optional_trimmed(input.codex_executable),
        sandbox: normalize_optional_sandbox(input.sandbox)?,
        approval_policy: normalize_optional_approval_policy(input.approval_policy)?,
    })
}

fn normalize_update_agent_queue_task_input(
    input: UpdateAgentQueueTaskInput,
) -> Result<NormalizedUpdateAgentQueueTaskInput, WorkspaceServiceError> {
    let status = normalize_status(input.status)?;
    let prompt = normalize_prompt(input.prompt, &status)?;
    Ok(NormalizedUpdateAgentQueueTaskInput {
        workspace_id: required_owned(input.workspace_id, "workspace id")?,
        queue_item_id: required_owned(input.queue_item_id, "queue item id")?,
        title: required_owned(input.title, "queue task title")?,
        description: input.description.trim().to_owned(),
        prompt,
        status,
        priority: normalize_priority(input.priority)?,
        depends_on: normalize_optional_dependency_ids(input.depends_on)?,
        execution_policy: normalize_optional_execution_policy(input.execution_policy)?,
        execution_workspace: normalize_optional_trimmed(input.execution_workspace),
        codex_executable: normalize_optional_trimmed(input.codex_executable),
        sandbox: normalize_optional_sandbox(input.sandbox)?,
        approval_policy: normalize_optional_approval_policy(input.approval_policy)?,
    })
}

fn normalize_assign_agent_queue_task_input(
    input: AssignAgentQueueTaskToExecutorInput,
) -> Result<NormalizedAssignAgentQueueTaskInput, WorkspaceServiceError> {
    Ok(NormalizedAssignAgentQueueTaskInput {
        workspace_id: required_owned(input.workspace_id, "workspace id")?,
        queue_item_id: required_owned(input.queue_item_id, "queue item id")?,
        executor_widget_instance_id: required_owned(
            input.executor_widget_instance_id,
            "executor widget instance id",
        )?,
    })
}

fn normalize_clear_agent_queue_task_assignment_input(
    input: ClearAgentQueueTaskAssignmentInput,
) -> Result<NormalizedClearAgentQueueTaskAssignmentInput, WorkspaceServiceError> {
    Ok(NormalizedClearAgentQueueTaskAssignmentInput {
        workspace_id: required_owned(input.workspace_id, "workspace id")?,
        queue_item_id: required_owned(input.queue_item_id, "queue item id")?,
    })
}

fn normalize_delete_agent_queue_task_input(
    input: DeleteAgentQueueTaskInput,
) -> Result<NormalizedDeleteAgentQueueTaskInput, WorkspaceServiceError> {
    Ok(NormalizedDeleteAgentQueueTaskInput {
        workspace_id: required_owned(input.workspace_id, "workspace id")?,
        queue_item_id: required_owned(input.queue_item_id, "queue item id")?,
    })
}

fn normalize_status(status: String) -> Result<String, WorkspaceServiceError> {
    let status = required_owned(status, "queue task status")?;
    match AgentQueueTaskLifecycleStatus::from_current_status(&status) {
        Some(_) => Ok(status),
        None => Err(WorkspaceServiceError::InvalidInput(format!(
            "unsupported queue task status: {status}"
        ))),
    }
}

fn normalize_prompt(prompt: String, status: &str) -> Result<String, WorkspaceServiceError> {
    let prompt = prompt.trim().to_owned();
    if AgentQueueTaskLifecycleStatus::from_current_status(status)
        .map(AgentQueueTaskLifecycleStatus::requires_prompt)
        .unwrap_or(true)
        && prompt.is_empty()
    {
        return Err(WorkspaceServiceError::InvalidInput(
            "queue task prompt must not be empty unless status is draft".to_owned(),
        ));
    }

    Ok(prompt)
}

fn normalize_priority(priority: i64) -> Result<i64, WorkspaceServiceError> {
    if !(MIN_AGENT_QUEUE_TASK_PRIORITY..=MAX_AGENT_QUEUE_TASK_PRIORITY).contains(&priority) {
        return Err(WorkspaceServiceError::InvalidInput(format!(
            "queue task priority must be between {MIN_AGENT_QUEUE_TASK_PRIORITY} and {MAX_AGENT_QUEUE_TASK_PRIORITY}"
        )));
    }

    Ok(priority)
}

fn normalize_execution_policy(
    execution_policy: Option<String>,
) -> Result<String, WorkspaceServiceError> {
    normalize_optional_execution_policy(execution_policy).map(|policy| {
        policy.unwrap_or_else(|| {
            AgentQueueTaskExecutionPolicy::default_for_new_task()
                .as_str()
                .to_owned()
        })
    })
}

fn normalize_optional_execution_policy(
    execution_policy: Option<String>,
) -> Result<Option<String>, WorkspaceServiceError> {
    let Some(execution_policy) = execution_policy else {
        return Ok(None);
    };

    let execution_policy = required_owned(execution_policy, "queue task execution policy")?;
    match AgentQueueTaskExecutionPolicy::from_current_policy(&execution_policy) {
        Some(_) => Ok(Some(execution_policy)),
        None => Err(WorkspaceServiceError::InvalidInput(format!(
            "unsupported queue task execution policy: {execution_policy}"
        ))),
    }
}

fn normalize_optional_sandbox(
    sandbox: Option<String>,
) -> Result<Option<String>, WorkspaceServiceError> {
    let Some(sandbox) = normalize_optional_trimmed(sandbox) else {
        return Ok(None);
    };

    match sandbox.as_str() {
        "read_only" | "workspace_write" | "danger_full_access" => Ok(Some(sandbox)),
        _ => Err(WorkspaceServiceError::InvalidInput(format!(
            "unsupported task sandbox: {sandbox}"
        ))),
    }
}

fn normalize_optional_approval_policy(
    approval_policy: Option<String>,
) -> Result<Option<String>, WorkspaceServiceError> {
    let Some(approval_policy) = normalize_optional_trimmed(approval_policy) else {
        return Ok(None);
    };

    match approval_policy.as_str() {
        "never" | "on_request" | "untrusted" => Ok(Some(approval_policy)),
        _ => Err(WorkspaceServiceError::InvalidInput(format!(
            "unsupported task approval policy: {approval_policy}"
        ))),
    }
}

fn normalize_optional_trimmed(value: Option<String>) -> Option<String> {
    value
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

fn required_owned(value: String, label: &str) -> Result<String, WorkspaceServiceError> {
    required_input(&value, label).map(str::to_owned)
}

pub(super) fn load_agent_queue_task(
    store: &hobit_storage_sqlite::SqliteStore,
    workspace_id: &str,
    queue_item_id: &str,
) -> Result<AgentQueueTaskRow, hobit_storage_sqlite::StorageError> {
    load_optional_agent_queue_task(store, workspace_id, queue_item_id)?
        .ok_or_else(|| storage_invalid_input(format!("queue task not found: {queue_item_id}")))
}

fn load_optional_agent_queue_task(
    store: &hobit_storage_sqlite::SqliteStore,
    workspace_id: &str,
    queue_item_id: &str,
) -> Result<Option<AgentQueueTaskRow>, hobit_storage_sqlite::StorageError> {
    if store.get_workspace(workspace_id)?.is_none() {
        return Err(storage_invalid_input(format!(
            "workspace not found: {workspace_id}"
        )));
    }

    let Some(task) = store.get_agent_queue_task_by_id(queue_item_id)? else {
        return Ok(None);
    };

    if task.workspace_id != workspace_id {
        return Err(storage_invalid_input(format!(
            "queue task does not belong to workspace: {queue_item_id}"
        )));
    }

    Ok(Some(task))
}

fn load_clearable_agent_queue_task(
    store: &hobit_storage_sqlite::SqliteStore,
    workspace_id: &str,
    queue_item_id: &str,
) -> Result<AgentQueueTaskRow, hobit_storage_sqlite::StorageError> {
    let task = load_agent_queue_task(store, workspace_id, queue_item_id)?;

    if !AgentQueueTaskLifecycleStatus::from_current_status(&task.status)
        .map(AgentQueueTaskLifecycleStatus::allows_assignment_clear)
        .unwrap_or(false)
    {
        return Err(storage_invalid_input(
            "queue task assignment cannot be cleared while status is running".to_owned(),
        ));
    }

    Ok(task)
}

fn load_assignable_agent_queue_task(
    store: &hobit_storage_sqlite::SqliteStore,
    workspace_id: &str,
    queue_item_id: &str,
) -> Result<AgentQueueTaskRow, hobit_storage_sqlite::StorageError> {
    let task = load_agent_queue_task(store, workspace_id, queue_item_id)?;

    if !is_assignable_agent_queue_task_status(&task.status) {
        return Err(storage_invalid_input(format!(
            "queue task status cannot be assigned: {}",
            task.status
        )));
    }

    Ok(task)
}

pub(super) fn load_agent_executor_widget(
    store: &hobit_storage_sqlite::SqliteStore,
    workspace_id: &str,
    executor_widget_instance_id: &str,
) -> Result<WidgetInstanceRow, hobit_storage_sqlite::StorageError> {
    let Some(widget) = store.get_widget_instance(executor_widget_instance_id)? else {
        return Err(storage_invalid_input(format!(
            "executor widget not found: {executor_widget_instance_id}"
        )));
    };

    if widget.workspace_id != workspace_id {
        return Err(storage_invalid_input(format!(
            "executor widget does not belong to workspace: {executor_widget_instance_id}"
        )));
    }

    if widget.definition_id != AGENT_RUN_WIDGET_DEFINITION_ID {
        return Err(storage_invalid_input(format!(
            "assigned widget is not an Agent Executor: {executor_widget_instance_id}"
        )));
    }

    Ok(widget)
}

fn is_assignable_agent_queue_task_status(status: &str) -> bool {
    AgentQueueTaskLifecycleStatus::from_current_status(status)
        .map(AgentQueueTaskLifecycleStatus::allows_assignment)
        .unwrap_or(false)
}

pub(super) fn storage_invalid_input(message: String) -> hobit_storage_sqlite::StorageError {
    hobit_storage_sqlite::StorageError::InvalidParameterName(message)
}

pub(super) fn map_storage_agent_queue_task_error(
    error: hobit_storage_sqlite::StorageError,
) -> WorkspaceServiceError {
    match error {
        hobit_storage_sqlite::StorageError::InvalidParameterName(message) => {
            WorkspaceServiceError::InvalidInput(message)
        }
        error => WorkspaceServiceError::from(error),
    }
}
