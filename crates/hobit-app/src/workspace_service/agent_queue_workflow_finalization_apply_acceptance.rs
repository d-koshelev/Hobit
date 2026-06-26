use super::super::MarkAgentQueueItemDoneInput;
use super::apply_shared::{
    complete_workflow_from_command, failed_unexpected_result, open_finalization_action,
    FinalizationCommandResult,
};
use super::*;

pub(super) fn execute_acceptance_finalization_step(
    service: &WorkspaceService,
    resolved: FinalizationStepResolution,
) -> Result<QueueWorkflowFinalizationStepResult, WorkspaceServiceError> {
    let opened_action = service
        .store
        .with_immediate_transaction(|store| open_finalization_action(store, &resolved))
        .map_err(map_storage_agent_queue_task_error)?;

    let command_result = service
        .mark_agent_queue_item_done(MarkAgentQueueItemDoneInput {
            workspace_id: resolved.request.workspace_id.clone(),
            queue_item_id: resolved.task_id.clone(),
            actor_id: resolved.request.actor_id.clone(),
            confirmation_token: resolved
                .request
                .confirmation_token
                .clone()
                .unwrap_or_default(),
            reason: Some("Accepted through backend-owned Queue workflow finalization.".to_owned()),
            run_id: Some(resolved.run_id.clone()),
            review_message_id: Some(resolved.review_message.message_id.clone()),
        })
        .map(FinalizationCommandResult::Completion);

    match command_result {
        Ok(command_result) => service
            .store
            .with_immediate_transaction(|store| {
                complete_workflow_from_command(
                    service,
                    store,
                    resolved,
                    opened_action,
                    command_result,
                )
            })
            .map_err(map_storage_agent_queue_task_error),
        Err(error) => service
            .store
            .with_immediate_transaction(|store| {
                failed_unexpected_result(
                    store,
                    resolved,
                    opened_action,
                    &format!("Queue workflow finalization failed unexpectedly: {error}"),
                )
            })
            .map_err(map_storage_agent_queue_task_error),
    }
}
