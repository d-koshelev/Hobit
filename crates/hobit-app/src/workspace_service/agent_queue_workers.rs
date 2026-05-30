use hobit_storage_sqlite::{AgentQueueWorkerUpdate, NewAgentQueueWorker};

use crate::WorkspaceServiceError;

use super::{
    agent_queue_tasks::{map_storage_agent_queue_task_error, storage_invalid_input},
    mapping::agent_queue_worker_summary,
    placeholder_id, placeholder_timestamp,
    validation::required_input,
    AgentQueueWorkerSummary, CreateAgentQueueWorkerInput, DeleteAgentQueueWorkerInput,
    UpdateAgentQueueWorkerInput, WorkspaceService,
};

const AGENT_QUEUE_WORKER_SCOPE_ALL: &str = "all";
const AGENT_QUEUE_WORKER_SCOPE_QUEUE_TAG: &str = "queue_tag";

impl WorkspaceService {
    pub fn list_agent_queue_workers(
        &self,
        workspace_id: &str,
    ) -> Result<Vec<AgentQueueWorkerSummary>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        if self.store.get_workspace(workspace_id)?.is_none() {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "workspace not found: {workspace_id}"
            )));
        }

        Ok(self
            .store
            .list_agent_queue_workers(workspace_id)?
            .into_iter()
            .map(agent_queue_worker_summary)
            .collect())
    }

    pub fn create_agent_queue_worker(
        &self,
        input: CreateAgentQueueWorkerInput,
    ) -> Result<AgentQueueWorkerSummary, WorkspaceServiceError> {
        let input = normalize_create_worker_input(input)?;
        let created_at = placeholder_timestamp();

        let worker = self
            .store
            .with_immediate_transaction(|store| {
                if store.get_workspace(&input.workspace_id)?.is_none() {
                    return Err(storage_invalid_input(format!(
                        "workspace not found: {}",
                        input.workspace_id
                    )));
                }

                let worker = store.create_agent_queue_worker(NewAgentQueueWorker {
                    worker_id: &input.worker_id,
                    workspace_id: &input.workspace_id,
                    name: &input.name,
                    enabled: input.enabled,
                    scope_kind: &input.scope_kind,
                    queue_tag_id: input.queue_tag_id.as_deref(),
                    queue_tag_name: input.queue_tag_name.as_deref(),
                    display_order: input.display_order,
                    created_at: Some(&created_at),
                    updated_at: Some(&created_at),
                })?;
                store.touch_workspace(&input.workspace_id)?;
                Ok(worker)
            })
            .map_err(map_storage_agent_queue_task_error)?;

        Ok(agent_queue_worker_summary(worker))
    }

    pub fn update_agent_queue_worker(
        &self,
        input: UpdateAgentQueueWorkerInput,
    ) -> Result<Option<AgentQueueWorkerSummary>, WorkspaceServiceError> {
        let input = normalize_update_worker_input(input)?;
        let updated_at = placeholder_timestamp();

        let worker = self
            .store
            .with_immediate_transaction(|store| {
                if store.get_workspace(&input.workspace_id)?.is_none() {
                    return Err(storage_invalid_input(format!(
                        "workspace not found: {}",
                        input.workspace_id
                    )));
                }

                let worker = store.update_agent_queue_worker(
                    &input.workspace_id,
                    &input.worker_id,
                    AgentQueueWorkerUpdate {
                        name: &input.name,
                        enabled: input.enabled,
                        scope_kind: &input.scope_kind,
                        queue_tag_id: input.queue_tag_id.as_deref(),
                        queue_tag_name: input.queue_tag_name.as_deref(),
                        display_order: input.display_order,
                        updated_at: Some(&updated_at),
                    },
                )?;
                if worker.is_some() {
                    store.touch_workspace(&input.workspace_id)?;
                }
                Ok(worker)
            })
            .map_err(map_storage_agent_queue_task_error)?;

        Ok(worker.map(agent_queue_worker_summary))
    }

    pub fn delete_agent_queue_worker(
        &self,
        input: DeleteAgentQueueWorkerInput,
    ) -> Result<bool, WorkspaceServiceError> {
        let workspace_id = required_owned(input.workspace_id, "workspace id")?;
        let worker_id = required_owned(input.worker_id, "worker id")?;

        let deleted = self
            .store
            .with_immediate_transaction(|store| {
                if store.get_workspace(&workspace_id)?.is_none() {
                    return Err(storage_invalid_input(format!(
                        "workspace not found: {workspace_id}"
                    )));
                }

                if store
                    .get_agent_queue_worker(&workspace_id, &worker_id)?
                    .is_none()
                {
                    return Ok(false);
                }

                let assigned_task = store
                    .list_agent_queue_tasks(&workspace_id)?
                    .into_iter()
                    .find(|task| task.assigned_executor_widget_id.as_deref() == Some(&worker_id));

                if let Some(task) = assigned_task {
                    return Err(storage_invalid_input(format!(
                        "worker is assigned to queue task: {}",
                        task.queue_item_id
                    )));
                }

                let deleted = store.delete_agent_queue_worker(&workspace_id, &worker_id)?;
                if deleted {
                    store.touch_workspace(&workspace_id)?;
                }
                Ok(deleted)
            })
            .map_err(map_storage_agent_queue_task_error)?;

        Ok(deleted)
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedWorkerInput {
    workspace_id: String,
    worker_id: String,
    name: String,
    enabled: bool,
    scope_kind: String,
    queue_tag_id: Option<String>,
    queue_tag_name: Option<String>,
    display_order: i64,
}

fn normalize_create_worker_input(
    input: CreateAgentQueueWorkerInput,
) -> Result<NormalizedWorkerInput, WorkspaceServiceError> {
    let worker_id = match input.worker_id {
        Some(worker_id) => required_owned(worker_id, "worker id")?,
        None => placeholder_id("agent_worker_"),
    };

    normalize_worker_input(
        input.workspace_id,
        worker_id,
        input.name,
        input.enabled,
        input.scope_kind,
        input.queue_tag_id,
        input.queue_tag_name,
        input.display_order,
    )
}

fn normalize_update_worker_input(
    input: UpdateAgentQueueWorkerInput,
) -> Result<NormalizedWorkerInput, WorkspaceServiceError> {
    let worker_id = required_owned(input.worker_id, "worker id")?;
    normalize_worker_input(
        input.workspace_id,
        worker_id,
        input.name,
        input.enabled,
        input.scope_kind,
        input.queue_tag_id,
        input.queue_tag_name,
        input.display_order,
    )
}

fn normalize_worker_input(
    workspace_id: String,
    worker_id: String,
    name: String,
    enabled: bool,
    scope_kind: String,
    queue_tag_id: Option<String>,
    queue_tag_name: Option<String>,
    display_order: i64,
) -> Result<NormalizedWorkerInput, WorkspaceServiceError> {
    let scope_kind = required_owned(scope_kind, "worker scope kind")?;
    let (queue_tag_id, queue_tag_name) = match scope_kind.as_str() {
        AGENT_QUEUE_WORKER_SCOPE_ALL => (None, None),
        AGENT_QUEUE_WORKER_SCOPE_QUEUE_TAG => (
            Some(required_owned(
                queue_tag_id.unwrap_or_default(),
                "worker queue tag id",
            )?),
            Some(required_owned(
                queue_tag_name.unwrap_or_default(),
                "worker queue tag name",
            )?),
        ),
        _ => {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "unsupported worker scope kind: {scope_kind}"
            )));
        }
    };

    if display_order < 0 {
        return Err(WorkspaceServiceError::InvalidInput(
            "worker display order must not be negative".to_owned(),
        ));
    }

    Ok(NormalizedWorkerInput {
        workspace_id: required_owned(workspace_id, "workspace id")?,
        worker_id,
        name: required_owned(name, "worker name")?,
        enabled,
        scope_kind,
        queue_tag_id,
        queue_tag_name,
        display_order,
    })
}

fn required_owned(value: String, label: &str) -> Result<String, WorkspaceServiceError> {
    required_input(&value, label).map(str::to_owned)
}
