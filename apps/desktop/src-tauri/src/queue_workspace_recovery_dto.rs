use hobit_app::QueueWorkspaceRecoveryProjection;
use serde::Serialize;

use crate::agent_queue_control_dto::AgentQueueControlStateDto;

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct QueueWorkspaceRecoveryProjectionDto {
    pub workspace_id: String,
    pub queue_task_count: usize,
    pub running_task_count: usize,
    pub stale_running_candidate_count: usize,
    pub has_visible_queue_view: bool,
    pub canonical_queue_widget_id: Option<String>,
    pub control_state: Option<AgentQueueControlStateDto>,
    pub recovery_available: bool,
    pub can_restore_queue_view: bool,
    pub recovery_reason: String,
}

impl From<QueueWorkspaceRecoveryProjection> for QueueWorkspaceRecoveryProjectionDto {
    fn from(projection: QueueWorkspaceRecoveryProjection) -> Self {
        Self {
            workspace_id: projection.workspace_id,
            queue_task_count: projection.queue_task_count,
            running_task_count: projection.running_task_count,
            stale_running_candidate_count: projection.stale_running_candidate_count,
            has_visible_queue_view: projection.has_visible_queue_view,
            canonical_queue_widget_id: projection.canonical_queue_widget_id,
            control_state: projection
                .control_state
                .map(AgentQueueControlStateDto::from),
            recovery_available: projection.recovery_available,
            can_restore_queue_view: projection.can_restore_queue_view,
            recovery_reason: projection.recovery_reason.as_str().to_owned(),
        }
    }
}
