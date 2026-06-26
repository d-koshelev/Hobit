use crate::WorkspaceServiceError;

use super::{
    agent_queue_workflow::QueueWorkflowRunStatus,
    agent_queue_workflow_start_step_projection::{
        action_plan_for, expected_refs, target_refs_preview,
    },
    agent_queue_workflow_start_step_support::{
        normalize_create_setup_start_step_request, workflow_request_hash, AWAITING_WORKER_STEP,
        START_PHASE,
    },
    agent_queue_workflow_start_step_types::{
        QueueWorkflowCreateSetupStartStepPlan, QueueWorkflowCreateSetupStartStepRequest,
        QueueWorkflowCreateSetupStartStepTransition,
    },
    WorkspaceService,
};

impl WorkspaceService {
    pub fn plan_queue_workflow_create_setup_start_step(
        &self,
        request: QueueWorkflowCreateSetupStartStepRequest,
    ) -> Result<QueueWorkflowCreateSetupStartStepPlan, WorkspaceServiceError> {
        let normalized = match normalize_create_setup_start_step_request(request) {
            Ok(normalized) => normalized,
            Err(blocker) => {
                return Ok(QueueWorkflowCreateSetupStartStepPlan {
                    workflow_run_id: None,
                    request_id: String::new(),
                    workflow_id: String::new(),
                    persistent_status: None,
                    phase: None,
                    current_step: None,
                    transition: QueueWorkflowCreateSetupStartStepTransition::CreateSetupStart,
                    executable: false,
                    already_applied: false,
                    request_hash: None,
                    action_plan: Vec::new(),
                    target_refs_preview: None,
                    blockers: vec![blocker],
                    expected_next_phase: None,
                    expected_next_step: None,
                    expected_refs: None,
                });
            }
        };
        let existing = if let Some(workflow_run_id) = normalized.workflow_run_id.as_deref() {
            self.store
                .get_agent_queue_workflow_run(&normalized.workspace_id, workflow_run_id)?
        } else {
            self.store.get_agent_queue_workflow_run_by_request(
                &normalized.workspace_id,
                &normalized.request_id,
            )?
        };
        let request_hash = workflow_request_hash(
            &normalized.workflow_id,
            &normalized.inputs,
            normalized.grant_summary.as_ref(),
        );
        let already_applied = existing.as_ref().is_some_and(|run| {
            run.phase == START_PHASE
                && run.current_step.as_deref() == Some(AWAITING_WORKER_STEP)
                && run.status == QueueWorkflowRunStatus::Paused.as_str()
        });
        Ok(QueueWorkflowCreateSetupStartStepPlan {
            workflow_run_id: existing
                .as_ref()
                .map(|run| run.workflow_run_id.clone())
                .or_else(|| normalized.workflow_run_id.clone()),
            request_id: normalized.request_id.clone(),
            workflow_id: normalized.workflow_id.clone(),
            persistent_status: existing.as_ref().map(|run| run.status.clone()),
            phase: existing.as_ref().map(|run| run.phase.clone()),
            current_step: existing.as_ref().and_then(|run| run.current_step.clone()),
            transition: QueueWorkflowCreateSetupStartStepTransition::CreateSetupStart,
            executable: !already_applied,
            already_applied,
            request_hash: Some(request_hash),
            action_plan: action_plan_for(&normalized, existing.as_ref()),
            target_refs_preview: Some(target_refs_preview(&normalized)),
            blockers: Vec::new(),
            expected_next_phase: Some(START_PHASE.to_owned()),
            expected_next_step: Some(AWAITING_WORKER_STEP.to_owned()),
            expected_refs: Some(expected_refs(&normalized)),
        })
    }
}
