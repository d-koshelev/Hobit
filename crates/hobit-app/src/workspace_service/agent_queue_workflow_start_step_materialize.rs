use crate::WorkspaceServiceError;

use super::{
    agent_queue_workflow_materialization::{
        QueueWorkflowMaterializeTaskSlotRequest, QueueWorkflowMaterializeTaskSlotStatus,
    },
    agent_queue_workflow_start_step_projection::empty_actions,
    agent_queue_workflow_start_step_support::{
        NormalizedCreateSetupStartStepRequest, DOWNSTREAM_SLOT, UPSTREAM_SLOT,
    },
    agent_queue_workflow_start_step_types::{
        QueueWorkflowCreateSetupStartActionSnapshots, QueueWorkflowCreateSetupStartStepResult,
    },
    AgentQueueTaskSummary, WorkspaceService,
};

pub(super) struct StartStepMaterializedTasks {
    pub upstream_task: AgentQueueTaskSummary,
    pub downstream_task: Option<AgentQueueTaskSummary>,
    pub actions: QueueWorkflowCreateSetupStartActionSnapshots,
}

pub(super) enum StartStepMaterializationOutcome {
    Ready(StartStepMaterializedTasks),
    Blocked(QueueWorkflowCreateSetupStartStepResult),
}

impl WorkspaceService {
    pub(super) fn apply_start_step_materialization(
        &self,
        normalized: &NormalizedCreateSetupStartStepRequest,
        workflow_run_id: &str,
    ) -> Result<StartStepMaterializationOutcome, WorkspaceServiceError> {
        let upstream_materialized = self.materialize_agent_queue_workflow_task_slot(
            QueueWorkflowMaterializeTaskSlotRequest {
                workspace_id: normalized.workspace_id.clone(),
                workflow_run_id: workflow_run_id.to_owned(),
                slot: UPSTREAM_SLOT.to_owned(),
                task_spec: normalized.upstream_task.clone(),
                task_spec_hash: Some(normalized.upstream_task_spec_hash.clone()),
                depends_on_slots: Vec::new(),
                actor_id: Some(normalized.actor_id.clone()),
                action_idempotency_key: None,
            },
        )?;
        let mut actions = QueueWorkflowCreateSetupStartActionSnapshots {
            create_task_upstream: upstream_materialized.action.clone(),
            ..empty_actions()
        };
        if !matches!(
            upstream_materialized.status,
            QueueWorkflowMaterializeTaskSlotStatus::Created
                | QueueWorkflowMaterializeTaskSlotStatus::Reused
        ) {
            return Ok(StartStepMaterializationOutcome::Blocked(
                self.blocked_from_substep(
                    normalized,
                    workflow_run_id.to_owned(),
                    actions,
                    upstream_materialized.blocker,
                    upstream_materialized.conflict,
                )?,
            ));
        }
        let upstream_task = upstream_materialized.task.clone().ok_or_else(|| {
            WorkspaceServiceError::InvalidInput(
                "upstream task missing after materialization".to_owned(),
            )
        })?;

        let downstream_materialized = self.materialize_agent_queue_workflow_task_slot(
            QueueWorkflowMaterializeTaskSlotRequest {
                workspace_id: normalized.workspace_id.clone(),
                workflow_run_id: workflow_run_id.to_owned(),
                slot: DOWNSTREAM_SLOT.to_owned(),
                task_spec: normalized.downstream_task.clone(),
                task_spec_hash: Some(normalized.downstream_task_spec_hash.clone()),
                depends_on_slots: normalized.downstream_depends_on_slots.clone(),
                actor_id: Some(normalized.actor_id.clone()),
                action_idempotency_key: None,
            },
        )?;
        actions.create_task_downstream = downstream_materialized.action.clone();
        if !matches!(
            downstream_materialized.status,
            QueueWorkflowMaterializeTaskSlotStatus::Created
                | QueueWorkflowMaterializeTaskSlotStatus::Reused
        ) {
            return Ok(StartStepMaterializationOutcome::Blocked(
                self.blocked_from_substep(
                    normalized,
                    workflow_run_id.to_owned(),
                    actions,
                    downstream_materialized.blocker,
                    downstream_materialized.conflict,
                )?,
            ));
        }

        Ok(StartStepMaterializationOutcome::Ready(
            StartStepMaterializedTasks {
                upstream_task,
                downstream_task: downstream_materialized.task.clone(),
                actions,
            },
        ))
    }
}
