use hobit_storage_sqlite::{AgentQueueTaskUpdate, NewAgentQueueTask};

use crate::WorkspaceServiceError;

use super::{
    mapping::agent_queue_task_summary, placeholder_id, placeholder_timestamp,
    validation::required_input, AgentQueueTaskSummary, CreateAgentQueueTaskInput,
    UpdateAgentQueueTaskInput, WorkspaceService,
};

const AGENT_QUEUE_TASK_STATUS_DRAFT: &str = "draft";
const AGENT_QUEUE_TASK_STATUS_QUEUED: &str = "queued";
const AGENT_QUEUE_TASK_STATUS_READY: &str = "ready";
const AGENT_QUEUE_TASK_STATUS_COMPLETED: &str = "completed";
const AGENT_QUEUE_TASK_STATUS_FAILED: &str = "failed";
const AGENT_QUEUE_TASK_STATUS_CANCELLED: &str = "cancelled";
const AGENT_QUEUE_TASK_STATUS_REVIEW_NEEDED: &str = "review_needed";
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

                let task = store.create_agent_queue_task(NewAgentQueueTask {
                    queue_item_id: &queue_item_id,
                    workspace_id: &input.workspace_id,
                    title: &input.title,
                    description: &input.description,
                    prompt: &input.prompt,
                    status: &input.status,
                    priority: input.priority,
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
            let task = store.update_agent_queue_task(
                &input.workspace_id,
                &input.queue_item_id,
                AgentQueueTaskUpdate {
                    title: &input.title,
                    description: &input.description,
                    prompt: &input.prompt,
                    status: &input.status,
                    priority: input.priority,
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
    })
}

fn normalize_status(status: String) -> Result<String, WorkspaceServiceError> {
    let status = required_owned(status, "queue task status")?;
    match status.as_str() {
        AGENT_QUEUE_TASK_STATUS_DRAFT
        | AGENT_QUEUE_TASK_STATUS_QUEUED
        | AGENT_QUEUE_TASK_STATUS_READY
        | AGENT_QUEUE_TASK_STATUS_COMPLETED
        | AGENT_QUEUE_TASK_STATUS_FAILED
        | AGENT_QUEUE_TASK_STATUS_CANCELLED
        | AGENT_QUEUE_TASK_STATUS_REVIEW_NEEDED => Ok(status),
        _ => Err(WorkspaceServiceError::InvalidInput(format!(
            "unsupported queue task status: {status}"
        ))),
    }
}

fn normalize_prompt(prompt: String, status: &str) -> Result<String, WorkspaceServiceError> {
    let prompt = prompt.trim().to_owned();
    if status != AGENT_QUEUE_TASK_STATUS_DRAFT && prompt.is_empty() {
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

fn required_owned(value: String, label: &str) -> Result<String, WorkspaceServiceError> {
    required_input(&value, label).map(str::to_owned)
}

fn map_storage_agent_queue_task_error(
    error: hobit_storage_sqlite::StorageError,
) -> WorkspaceServiceError {
    match error {
        hobit_storage_sqlite::StorageError::InvalidParameterName(message) => {
            WorkspaceServiceError::InvalidInput(message)
        }
        error => WorkspaceServiceError::from(error),
    }
}
