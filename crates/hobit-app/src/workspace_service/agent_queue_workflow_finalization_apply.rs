use super::apply_acceptance::execute_acceptance_finalization_step;
use super::apply_failure::execute_failure_finalization_step;
use super::apply_shared::{complete_workflow_from_existing_decision, non_ready_result};
use super::support::matching_decision;
use super::*;

pub(super) fn execute_finalization_step_resolution(
    service: &WorkspaceService,
    resolution: FinalizationStepResolveStatus,
) -> Result<QueueWorkflowFinalizationStepResult, WorkspaceServiceError> {
    match resolution {
        FinalizationStepResolveStatus::Ready(resolved) => {
            execute_ready_finalization_step(service, resolved)
        }
        other => service
            .store
            .with_immediate_transaction(|store| non_ready_result(store, other))
            .map_err(map_storage_agent_queue_task_error),
    }
}

fn execute_ready_finalization_step(
    service: &WorkspaceService,
    resolved: FinalizationStepResolution,
) -> Result<QueueWorkflowFinalizationStepResult, WorkspaceServiceError> {
    if matching_decision(
        resolved.transition,
        resolved.completion_decision.as_ref(),
        resolved.failure_decision.as_ref(),
    )
    .is_some()
    {
        return service
            .store
            .with_immediate_transaction(|store| {
                complete_workflow_from_existing_decision(service, store, resolved)
            })
            .map_err(map_storage_agent_queue_task_error);
    }

    match resolved.transition {
        QueueWorkflowFinalizationStepTransition::FinalizeDone => {
            execute_acceptance_finalization_step(service, resolved)
        }
        QueueWorkflowFinalizationStepTransition::FinalizeFail => {
            execute_failure_finalization_step(service, resolved)
        }
    }
}
