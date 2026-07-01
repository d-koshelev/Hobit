use super::super::FailAgentQueueItemInput;
use super::apply_shared::{
    complete_workflow_from_command, failed_unexpected_result, open_finalization_action,
    FinalizationCommandResult,
};
use super::*;

pub(super) fn execute_failure_finalization_step(
    service: &WorkspaceService,
    resolved: FinalizationStepResolution,
) -> Result<QueueWorkflowFinalizationStepResult, WorkspaceServiceError> {
    let opened_action = service
        .store
        .with_immediate_transaction(|store| open_finalization_action(store, &resolved))
        .map_err(map_storage_agent_queue_task_error)?;

    let command_result = service
        .fail_agent_queue_item(FailAgentQueueItemInput {
            workspace_id: resolved.request.workspace_id.clone(),
            queue_item_id: resolved.task_id.clone(),
            actor_id: resolved.request.actor_id.clone(),
            confirmation_token: resolved
                .request
                .confirmation_token
                .clone()
                .unwrap_or_default(),
            reason: resolved.request.failure_reason.clone().unwrap_or_default(),
            run_id: Some(resolved.run_id.clone()),
            evidence_bundle_id: Some(resolved.evidence.bundle_id.clone()),
            review_message_id: Some(resolved.review_message.message_id.clone()),
        })
        .map(FinalizationCommandResult::Failure);

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
