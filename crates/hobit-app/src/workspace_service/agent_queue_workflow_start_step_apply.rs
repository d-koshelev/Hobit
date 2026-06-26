use std::collections::BTreeMap;

use crate::WorkspaceServiceError;

use super::{
    agent_queue_workflow::QueueWorkflowRunStatus,
    agent_queue_workflow_start_step_materialize::StartStepMaterializationOutcome,
    agent_queue_workflow_start_step_projection::{empty_actions, invalid_result},
    agent_queue_workflow_start_step_promote::StartStepPromoteOutcome,
    agent_queue_workflow_start_step_settings::StartStepSettingsOutcome,
    agent_queue_workflow_start_step_state::StartStepRunResolution,
    agent_queue_workflow_start_step_support::{
        normalize_create_setup_start_step_request, AWAITING_WORKER_STEP,
        CREATE_SETUP_START_BLOCKED_STEP, START_PHASE,
    },
    agent_queue_workflow_start_step_types::{
        QueueWorkflowCreateSetupStartStepRequest, QueueWorkflowCreateSetupStartStepResult,
        QueueWorkflowCreateSetupStartStepResultStatus, QueueWorkflowCreateSetupStartStepTransition,
    },
    WorkspaceService,
};

impl WorkspaceService {
    pub fn execute_queue_workflow_create_setup_start_step(
        &self,
        request: QueueWorkflowCreateSetupStartStepRequest,
    ) -> Result<QueueWorkflowCreateSetupStartStepResult, WorkspaceServiceError> {
        let normalized = match normalize_create_setup_start_step_request(request) {
            Ok(normalized) => normalized,
            Err(blocker) => return Ok(invalid_result(String::new(), String::new(), blocker)),
        };
        let workflow_run = match self.start_or_load_workflow_for_start_step(&normalized)? {
            StartStepRunResolution::Ready(run, _status) => run,
            StartStepRunResolution::Invalid(blocker) => {
                return Ok(invalid_result(
                    normalized.request_id,
                    normalized.workflow_id,
                    blocker,
                ));
            }
            StartStepRunResolution::Conflict(run, conflict) => {
                return Ok(QueueWorkflowCreateSetupStartStepResult {
                    workflow_run_id: Some(run.workflow_run_id.clone()),
                    request_id: normalized.request_id,
                    workflow_id: normalized.workflow_id,
                    transition: QueueWorkflowCreateSetupStartStepTransition::CreateSetupStart,
                    status: QueueWorkflowCreateSetupStartStepResultStatus::Conflict,
                    actions: empty_actions(),
                    slot_binding_snapshot: None,
                    task_ids_by_slot: BTreeMap::new(),
                    run_ids_by_slot: BTreeMap::new(),
                    settings_hash: Some(normalized.settings_hash),
                    execution_target_hash: Some(normalized.execution_target_hash),
                    execution_target_kind: Some(normalized.execution_target_kind),
                    provider_id: Some(normalized.provider_id),
                    workflow_run: Some(run),
                    next_phase: Some(START_PHASE.to_owned()),
                    next_step: Some(CREATE_SETUP_START_BLOCKED_STEP.to_owned()),
                    queue_control: None,
                    downstream_verification: None,
                    blockers: Vec::new(),
                    conflict: Some(conflict),
                });
            }
        };
        let workflow_run_id = workflow_run.workflow_run_id.clone();
        if workflow_run.phase == START_PHASE
            && workflow_run.current_step.as_deref() == Some(AWAITING_WORKER_STEP)
            && workflow_run.status == QueueWorkflowRunStatus::Paused.as_str()
        {
            return self.already_applied_start_step_result(normalized, workflow_run);
        }

        let materialized =
            match self.apply_start_step_materialization(&normalized, &workflow_run_id)? {
                StartStepMaterializationOutcome::Ready(materialized) => materialized,
                StartStepMaterializationOutcome::Blocked(result) => return Ok(result),
            };
        let actions = match self.apply_start_step_run_settings(
            &normalized,
            &workflow_run_id,
            &materialized.upstream_task,
            materialized.downstream_task.as_ref(),
            materialized.actions,
        )? {
            StartStepSettingsOutcome::Ready(actions) => actions,
            StartStepSettingsOutcome::Blocked(result) => return Ok(result),
        };
        let actions = match self.apply_start_step_promote(
            &normalized,
            &workflow_run_id,
            &materialized.upstream_task,
            materialized.downstream_task.as_ref(),
            actions,
        )? {
            StartStepPromoteOutcome::Ready(actions) => actions,
            StartStepPromoteOutcome::Blocked(result) => return Ok(result),
        };
        self.apply_start_step_worker_start(
            normalized,
            workflow_run_id,
            materialized.upstream_task,
            materialized.downstream_task,
            actions,
        )
    }
}
