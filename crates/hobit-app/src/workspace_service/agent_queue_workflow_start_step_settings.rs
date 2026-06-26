use crate::WorkspaceServiceError;

use super::{
    agent_queue_workflow_setup::{
        QueueWorkflowApplyRunSettingsRequest, QueueWorkflowApplyRunSettingsStatus,
    },
    agent_queue_workflow_start_step_support::{
        NormalizedCreateSetupStartStepRequest, UPSTREAM_SLOT,
    },
    agent_queue_workflow_start_step_types::{
        QueueWorkflowCreateSetupStartActionSnapshots, QueueWorkflowCreateSetupStartStepResult,
    },
    AgentQueueTaskSummary, WorkspaceService,
};

pub(super) enum StartStepSettingsOutcome {
    Ready(QueueWorkflowCreateSetupStartActionSnapshots),
    Blocked(QueueWorkflowCreateSetupStartStepResult),
}

impl WorkspaceService {
    pub(super) fn apply_start_step_run_settings(
        &self,
        normalized: &NormalizedCreateSetupStartStepRequest,
        workflow_run_id: &str,
        upstream_task: &AgentQueueTaskSummary,
        downstream_task: Option<&AgentQueueTaskSummary>,
        mut actions: QueueWorkflowCreateSetupStartActionSnapshots,
    ) -> Result<StartStepSettingsOutcome, WorkspaceServiceError> {
        let settings =
            self.apply_agent_queue_workflow_run_settings(QueueWorkflowApplyRunSettingsRequest {
                workspace_id: normalized.workspace_id.clone(),
                workflow_run_id: workflow_run_id.to_owned(),
                slot: UPSTREAM_SLOT.to_owned(),
                task_id: Some(upstream_task.queue_item_id.clone()),
                run_settings: normalized.run_settings.clone(),
                settings_hash: Some(normalized.settings_hash.clone()),
                actor_id: Some(normalized.actor_id.clone()),
                action_idempotency_key: None,
            })?;
        actions.update_run_settings = settings.action.clone();
        if !matches!(
            settings.status,
            QueueWorkflowApplyRunSettingsStatus::Applied
                | QueueWorkflowApplyRunSettingsStatus::Reused
        ) {
            return Ok(StartStepSettingsOutcome::Blocked(
                self.blocked_from_substep(
                    normalized,
                    workflow_run_id.to_owned(),
                    actions,
                    settings.blocker,
                    settings.conflict,
                )?,
            ));
        }
        let _ = downstream_task;
        Ok(StartStepSettingsOutcome::Ready(actions))
    }
}
