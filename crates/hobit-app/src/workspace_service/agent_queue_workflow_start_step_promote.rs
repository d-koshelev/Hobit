use crate::WorkspaceServiceError;

use super::{
    agent_queue_workflow_setup::{
        QueueWorkflowPromoteTaskSlotRequest, QueueWorkflowPromoteTaskSlotStatus,
    },
    agent_queue_workflow_start_step_support::{
        NormalizedCreateSetupStartStepRequest, UPSTREAM_SLOT,
    },
    agent_queue_workflow_start_step_types::{
        QueueWorkflowCreateSetupStartActionSnapshots, QueueWorkflowCreateSetupStartStepResult,
    },
    AgentQueueTaskSummary, WorkspaceService,
};

pub(super) enum StartStepPromoteOutcome {
    Ready(QueueWorkflowCreateSetupStartActionSnapshots),
    Blocked(QueueWorkflowCreateSetupStartStepResult),
}

impl WorkspaceService {
    pub(super) fn apply_start_step_promote(
        &self,
        normalized: &NormalizedCreateSetupStartStepRequest,
        workflow_run_id: &str,
        upstream_task: &AgentQueueTaskSummary,
        downstream_task: Option<&AgentQueueTaskSummary>,
        mut actions: QueueWorkflowCreateSetupStartActionSnapshots,
    ) -> Result<StartStepPromoteOutcome, WorkspaceServiceError> {
        let promote =
            self.promote_agent_queue_workflow_task_slot(QueueWorkflowPromoteTaskSlotRequest {
                workspace_id: normalized.workspace_id.clone(),
                workflow_run_id: workflow_run_id.to_owned(),
                slot: UPSTREAM_SLOT.to_owned(),
                task_id: Some(upstream_task.queue_item_id.clone()),
                task_spec_hash: normalized.upstream_task_spec_hash.clone(),
                settings_hash: normalized.settings_hash.clone(),
                actor_id: Some(normalized.actor_id.clone()),
                action_idempotency_key: None,
            })?;
        actions.promote_task = promote.action.clone();
        if !matches!(
            promote.status,
            QueueWorkflowPromoteTaskSlotStatus::Promoted
                | QueueWorkflowPromoteTaskSlotStatus::Reused
        ) {
            return Ok(StartStepPromoteOutcome::Blocked(
                self.blocked_from_substep(
                    normalized,
                    workflow_run_id.to_owned(),
                    actions,
                    promote.blocker,
                    promote.conflict,
                )?,
            ));
        }
        let _ = downstream_task;
        Ok(StartStepPromoteOutcome::Ready(actions))
    }
}
