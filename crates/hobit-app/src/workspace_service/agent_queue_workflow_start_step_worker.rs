use std::path::PathBuf;

use crate::WorkspaceServiceError;

use super::{
    agent_queue_workflow_start_step_projection::{
        action_blocker, action_run_id, blocked_start_step_result, success_start_step_result,
    },
    agent_queue_workflow_start_step_support::{
        command_blocker_from_message, start_worker_idempotency_key,
        NormalizedCreateSetupStartStepRequest, UPSTREAM_SLOT,
    },
    agent_queue_workflow_start_step_types::{
        QueueWorkflowCreateSetupStartActionSnapshots, QueueWorkflowCreateSetupStartStepResult,
    },
    AgentQueueTaskRunSource, AgentQueueTaskSummary, QueueWorkerStartContext,
    StartAssignedAgentQueueTaskInput, WorkspaceService,
};

impl WorkspaceService {
    pub(super) fn apply_start_step_worker_start(
        &self,
        normalized: NormalizedCreateSetupStartStepRequest,
        workflow_run_id: String,
        upstream_task: AgentQueueTaskSummary,
        downstream_task: Option<AgentQueueTaskSummary>,
        mut actions: QueueWorkflowCreateSetupStartActionSnapshots,
    ) -> Result<QueueWorkflowCreateSetupStartStepResult, WorkspaceServiceError> {
        let control = self.get_agent_queue_control_state(&normalized.workspace_id)?;
        let start_key = start_worker_idempotency_key(
            &workflow_run_id,
            &upstream_task.queue_item_id,
            &normalized.execution_target_hash,
            &normalized.settings_hash,
        );
        if let Some(existing_start) = self.workflow_action_by_key(&workflow_run_id, &start_key)? {
            if existing_start.status == "completed" {
                if let Some(existing_run_id) = action_run_id(&existing_start) {
                    actions.start_worker = Some(existing_start);
                    let updated_run = self.update_start_step_workflow_report(
                        &normalized,
                        &workflow_run_id,
                        &upstream_task,
                        downstream_task.as_ref(),
                        Some(existing_run_id.clone()),
                        None,
                        &actions,
                    )?;
                    let downstream_verification = self.downstream_verification(
                        &normalized.workspace_id,
                        downstream_task.as_ref(),
                    )?;
                    return Ok(success_start_step_result(
                        normalized,
                        updated_run,
                        actions,
                        control,
                        downstream_verification,
                        true,
                    ));
                }
            }
        }
        let start_result = self.start_assigned_agent_queue_task_with_run_source(
            StartAssignedAgentQueueTaskInput {
                workspace_id: normalized.workspace_id.clone(),
                queue_item_id: upstream_task.queue_item_id.clone(),
                queue_owner_widget_instance_id: normalized.queue_owner_widget_instance_id.clone(),
                codex_executable: normalized.run_settings.codex_executable.clone(),
                repo_root: PathBuf::from(&normalized.run_settings.execution_workspace),
                sandbox: normalized.run_settings.sandbox.clone(),
                approval_policy: normalized.run_settings.approval_policy.clone(),
                timeout_ms: None,
                stdout_cap_bytes: None,
                stderr_cap_bytes: None,
                workflow_start_context: Some(QueueWorkerStartContext {
                    workflow_run_id: workflow_run_id.clone(),
                    workflow_action_id: None,
                    action_idempotency_key: Some(start_key.clone()),
                    slot: Some(UPSTREAM_SLOT.to_owned()),
                    task_id: upstream_task.queue_item_id.clone(),
                    executor_widget_id: normalized.executor_widget_id.clone(),
                    settings_hash: normalized.settings_hash.clone(),
                    execution_target_hash: Some(normalized.execution_target_hash.clone()),
                    expected_queue_control_version: normalized.expected_queue_control_version,
                    actor_id: Some(normalized.actor_id.clone()),
                    confirmation_token: normalized.confirmation_token.clone(),
                }),
            },
            AgentQueueTaskRunSource::Manual,
        );
        actions.start_worker = self.workflow_action_by_key(&workflow_run_id, &start_key)?;
        match start_result {
            Ok(start) => {
                let run_id = start.run_id;
                actions.start_worker = self.workflow_action_by_key(&workflow_run_id, &start_key)?;
                let updated_run = self.update_start_step_workflow_report(
                    &normalized,
                    &workflow_run_id,
                    &upstream_task,
                    downstream_task.as_ref(),
                    Some(run_id.clone()),
                    None,
                    &actions,
                )?;
                let downstream_verification = self
                    .downstream_verification(&normalized.workspace_id, downstream_task.as_ref())?;
                Ok(success_start_step_result(
                    normalized,
                    updated_run,
                    actions,
                    control,
                    downstream_verification,
                    start.status == "already_started",
                ))
            }
            Err(WorkspaceServiceError::InvalidInput(message)) => {
                actions.start_worker = self.workflow_action_by_key(&workflow_run_id, &start_key)?;
                let blocker = actions
                    .start_worker
                    .as_ref()
                    .and_then(action_blocker)
                    .unwrap_or_else(|| {
                        command_blocker_from_message("worker_start_blocked", message)
                    });
                let updated_run = self.update_start_step_workflow_report(
                    &normalized,
                    &workflow_run_id,
                    &upstream_task,
                    downstream_task.as_ref(),
                    None,
                    Some(blocker.blocker_message.clone()),
                    &actions,
                )?;
                let downstream_verification = self
                    .downstream_verification(&normalized.workspace_id, downstream_task.as_ref())?;
                Ok(blocked_start_step_result(
                    normalized,
                    updated_run,
                    actions,
                    control,
                    downstream_verification,
                    blocker,
                ))
            }
            Err(error) => Err(error),
        }
    }
}
