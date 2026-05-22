use hobit_storage_sqlite::{
    AgentQueueTaskRunLinkFinalUpdate, AgentQueueTaskRunLinkRow, NewAgentQueueTaskRunLink,
};

use crate::WorkspaceServiceError;

use super::{
    agent_queue_tasks::{
        load_agent_executor_widget, load_agent_queue_task, map_storage_agent_queue_task_error,
        storage_invalid_input,
    },
    direct_work::{can_initiate_direct_work, CODEX_DIRECT_WORK_COMMAND_KIND},
    placeholder_id, placeholder_timestamp,
    validation::{required_input, validate_widget_run_ownership},
    AgentQueueTaskRunLink, AgentQueueTaskRunLinkId, AgentQueueTaskRunReviewStatus,
    AgentQueueTaskRunSource, AgentQueueTaskRunStatus, AgentQueueTaskRunSummary,
    RecordAgentQueueTaskRunFinalStatusInput, RecordAgentQueueTaskRunStartedInput, WorkspaceService,
};

impl WorkspaceService {
    pub fn record_agent_queue_task_run_started(
        &self,
        input: RecordAgentQueueTaskRunStartedInput,
    ) -> Result<AgentQueueTaskRunSummary, WorkspaceServiceError> {
        let input = normalize_record_run_started_input(input)?;

        self.store
            .with_immediate_transaction(|store| {
                validate_queue_task_executor_run_link(
                    store,
                    &input.workspace_id,
                    &input.queue_task_id,
                    &input.executor_widget_id,
                    &input.direct_work_run_id,
                )?;

                let link_id = placeholder_id("queue_run_link_");
                let now = placeholder_timestamp();
                let link = store.insert_agent_queue_task_run_link(NewAgentQueueTaskRunLink {
                    link_id: &link_id,
                    workspace_id: &input.workspace_id,
                    queue_task_id: &input.queue_task_id,
                    executor_widget_id: &input.executor_widget_id,
                    direct_work_run_id: &input.direct_work_run_id,
                    source: input.source.as_str(),
                    status: AgentQueueTaskRunStatus::Running.as_str(),
                    started_at: Some(&now),
                    completed_at: None,
                    validation_status: None,
                    review_status: None,
                    created_at: Some(&now),
                    updated_at: Some(&now),
                })?;
                store.touch_workspace(&input.workspace_id)?;
                Ok(link)
            })
            .map(map_run_link_row)
            .map_err(map_storage_agent_queue_task_error)
    }

    pub fn record_agent_queue_task_run_final_status(
        &self,
        input: RecordAgentQueueTaskRunFinalStatusInput,
    ) -> Result<Option<AgentQueueTaskRunSummary>, WorkspaceServiceError> {
        let input = normalize_record_run_final_status_input(input)?;

        self.store
            .with_immediate_transaction(|store| {
                validate_queue_task_executor_run_link(
                    store,
                    &input.workspace_id,
                    &input.queue_task_id,
                    &input.executor_widget_id,
                    &input.direct_work_run_id,
                )?;

                let completed_at = match input.completed_at.clone() {
                    Some(completed_at) => Some(completed_at),
                    None => store
                        .get_widget_run(&input.direct_work_run_id)?
                        .and_then(|run| run.finished_at),
                };
                let review_status = input.review_status.or_else(|| {
                    Some(match input.status {
                        AgentQueueTaskRunStatus::Running => AgentQueueTaskRunReviewStatus::Unknown,
                        _ => AgentQueueTaskRunReviewStatus::ReviewNeeded,
                    })
                });
                let updated_at = placeholder_timestamp();
                let link = store.update_agent_queue_task_run_link_final_status(
                    &input.workspace_id,
                    &input.queue_task_id,
                    &input.direct_work_run_id,
                    AgentQueueTaskRunLinkFinalUpdate {
                        status: input.status.as_str(),
                        completed_at: completed_at.as_deref(),
                        validation_status: input.validation_status.as_deref(),
                        review_status: review_status.map(AgentQueueTaskRunReviewStatus::as_str),
                        updated_at: Some(&updated_at),
                    },
                )?;
                if link.is_some() {
                    store.touch_workspace(&input.workspace_id)?;
                }
                Ok(link)
            })
            .map(|link| link.map(map_run_link_row))
            .map_err(map_storage_agent_queue_task_error)
    }

    pub fn list_agent_queue_task_run_links(
        &self,
        workspace_id: &str,
        queue_task_id: &str,
    ) -> Result<Vec<AgentQueueTaskRunSummary>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let queue_task_id = required_input(queue_task_id, "queue task id")?;
        self.validate_agent_queue_run_link_task_access(workspace_id, queue_task_id)?;

        Ok(self
            .store
            .list_agent_queue_task_run_links(workspace_id, queue_task_id)?
            .into_iter()
            .map(map_run_link_row)
            .collect())
    }

    pub fn get_latest_agent_queue_task_run_link(
        &self,
        workspace_id: &str,
        queue_task_id: &str,
    ) -> Result<Option<AgentQueueTaskRunSummary>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let queue_task_id = required_input(queue_task_id, "queue task id")?;
        self.validate_agent_queue_run_link_task_access(workspace_id, queue_task_id)?;

        Ok(self
            .store
            .get_latest_agent_queue_task_run_link(workspace_id, queue_task_id)?
            .map(map_run_link_row))
    }

    fn validate_agent_queue_run_link_task_access(
        &self,
        workspace_id: &str,
        queue_task_id: &str,
    ) -> Result<(), WorkspaceServiceError> {
        load_agent_queue_task(&self.store, workspace_id, queue_task_id)
            .map(|_| ())
            .map_err(map_storage_agent_queue_task_error)
    }
}

struct NormalizedRecordRunStartedInput {
    workspace_id: String,
    queue_task_id: String,
    executor_widget_id: String,
    direct_work_run_id: String,
    source: AgentQueueTaskRunSource,
}

struct NormalizedRecordRunFinalStatusInput {
    workspace_id: String,
    queue_task_id: String,
    executor_widget_id: String,
    direct_work_run_id: String,
    status: AgentQueueTaskRunStatus,
    completed_at: Option<String>,
    validation_status: Option<String>,
    review_status: Option<AgentQueueTaskRunReviewStatus>,
}

fn normalize_record_run_started_input(
    input: RecordAgentQueueTaskRunStartedInput,
) -> Result<NormalizedRecordRunStartedInput, WorkspaceServiceError> {
    Ok(NormalizedRecordRunStartedInput {
        workspace_id: required_input(&input.workspace_id, "workspace id")?.to_owned(),
        queue_task_id: required_input(&input.queue_task_id, "queue task id")?.to_owned(),
        executor_widget_id: required_input(&input.executor_widget_id, "executor widget id")?
            .to_owned(),
        direct_work_run_id: required_input(&input.direct_work_run_id, "Direct Work run id")?
            .to_owned(),
        source: input.source,
    })
}

fn normalize_record_run_final_status_input(
    input: RecordAgentQueueTaskRunFinalStatusInput,
) -> Result<NormalizedRecordRunFinalStatusInput, WorkspaceServiceError> {
    let status_text = required_input(&input.status, "run link status")?;
    let status = AgentQueueTaskRunStatus::from_current_status(status_text);
    Ok(NormalizedRecordRunFinalStatusInput {
        workspace_id: required_input(&input.workspace_id, "workspace id")?.to_owned(),
        queue_task_id: required_input(&input.queue_task_id, "queue task id")?.to_owned(),
        executor_widget_id: required_input(&input.executor_widget_id, "executor widget id")?
            .to_owned(),
        direct_work_run_id: required_input(&input.direct_work_run_id, "Direct Work run id")?
            .to_owned(),
        status,
        completed_at: input.completed_at,
        validation_status: input.validation_status,
        review_status: input.review_status,
    })
}

pub(super) fn record_agent_queue_task_run_started_in_store(
    store: &hobit_storage_sqlite::SqliteStore,
    workspace_id: &str,
    queue_task_id: &str,
    executor_widget_id: &str,
    direct_work_run_id: &str,
    source: AgentQueueTaskRunSource,
) -> Result<AgentQueueTaskRunSummary, hobit_storage_sqlite::StorageError> {
    validate_queue_task_executor_run_link(
        store,
        workspace_id,
        queue_task_id,
        executor_widget_id,
        direct_work_run_id,
    )?;

    let link_id = placeholder_id("queue_run_link_");
    let now = placeholder_timestamp();
    store
        .insert_agent_queue_task_run_link(NewAgentQueueTaskRunLink {
            link_id: &link_id,
            workspace_id,
            queue_task_id,
            executor_widget_id,
            direct_work_run_id,
            source: source.as_str(),
            status: AgentQueueTaskRunStatus::Running.as_str(),
            started_at: Some(&now),
            completed_at: None,
            validation_status: None,
            review_status: None,
            created_at: Some(&now),
            updated_at: Some(&now),
        })
        .map(map_run_link_row)
}

pub(super) fn record_agent_queue_task_run_final_status_in_store(
    store: &hobit_storage_sqlite::SqliteStore,
    workspace_id: &str,
    queue_task_id: &str,
    executor_widget_id: &str,
    direct_work_run_id: &str,
    status: &str,
) -> Result<Option<AgentQueueTaskRunSummary>, hobit_storage_sqlite::StorageError> {
    validate_queue_task_executor_run_link(
        store,
        workspace_id,
        queue_task_id,
        executor_widget_id,
        direct_work_run_id,
    )?;

    let status = AgentQueueTaskRunStatus::from_current_status(status);
    let completed_at = store
        .get_widget_run(direct_work_run_id)?
        .and_then(|run| run.finished_at);
    let review_status = match status {
        AgentQueueTaskRunStatus::Running => AgentQueueTaskRunReviewStatus::Unknown,
        _ => AgentQueueTaskRunReviewStatus::ReviewNeeded,
    };
    let updated_at = placeholder_timestamp();

    store
        .update_agent_queue_task_run_link_final_status(
            workspace_id,
            queue_task_id,
            direct_work_run_id,
            AgentQueueTaskRunLinkFinalUpdate {
                status: status.as_str(),
                completed_at: completed_at.as_deref(),
                validation_status: None,
                review_status: Some(review_status.as_str()),
                updated_at: Some(&updated_at),
            },
        )
        .map(|link| link.map(map_run_link_row))
}

fn validate_queue_task_executor_run_link(
    store: &hobit_storage_sqlite::SqliteStore,
    workspace_id: &str,
    queue_task_id: &str,
    executor_widget_id: &str,
    direct_work_run_id: &str,
) -> Result<(), hobit_storage_sqlite::StorageError> {
    let task = load_agent_queue_task(store, workspace_id, queue_task_id)?;
    if task.assigned_executor_widget_id.as_deref() != Some(executor_widget_id) {
        return Err(storage_invalid_input(
            "queue task is not assigned to the linked Agent Executor".to_owned(),
        ));
    }

    let executor = load_agent_executor_widget(store, workspace_id, executor_widget_id)?;
    let Some((_workspace, _workbench, widget, run)) = validate_widget_run_ownership(
        store,
        workspace_id,
        &executor.workbench_id,
        &executor.id,
        direct_work_run_id,
    )?
    else {
        return Err(storage_invalid_input(format!(
            "Direct Work run not found for queue task: {direct_work_run_id}"
        )));
    };

    if !can_initiate_direct_work(&widget.definition_id)
        || run.command_kind.as_deref() != Some(CODEX_DIRECT_WORK_COMMAND_KIND)
    {
        return Err(storage_invalid_input(
            "queue task run is not an Agent Executor Direct Work run".to_owned(),
        ));
    }

    Ok(())
}

fn map_run_link_row(row: AgentQueueTaskRunLinkRow) -> AgentQueueTaskRunLink {
    AgentQueueTaskRunLink {
        link_id: AgentQueueTaskRunLinkId(row.link_id),
        workspace_id: row.workspace_id,
        queue_task_id: row.queue_task_id,
        executor_widget_id: row.executor_widget_id,
        direct_work_run_id: row.direct_work_run_id,
        source: AgentQueueTaskRunSource::from_current_source(&row.source),
        status: AgentQueueTaskRunStatus::from_current_status(&row.status),
        started_at: row.started_at,
        completed_at: row.completed_at,
        validation_status: row.validation_status,
        review_status: row.review_status.as_deref().map(|value| match value {
            "review_needed" => AgentQueueTaskRunReviewStatus::ReviewNeeded,
            _ => AgentQueueTaskRunReviewStatus::Unknown,
        }),
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}
