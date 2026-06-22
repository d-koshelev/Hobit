use hobit_app::{
    AgentQueueControlCommandBlocker, AgentQueueControlStateSummary, SetAgentQueueControlStateInput,
    SetAgentQueueControlStateResult,
};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct GetAgentQueueControlStateRequest {
    pub workspace_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct SetAgentQueueControlStateRequest {
    pub workspace_id: String,
    pub status: String,
    #[serde(default)]
    pub actor_id: Option<String>,
    #[serde(default)]
    pub reason: Option<String>,
    #[serde(default)]
    pub expected_version: Option<i64>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueControlStateDto {
    pub workspace_id: String,
    pub status: String,
    pub version: i64,
    pub updated_by_actor_id: Option<String>,
    pub reason: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueControlCommandBlockerDto {
    pub blocker_code: String,
    pub blocker_message: String,
    pub expected_version: Option<i64>,
    pub actual_version: Option<i64>,
    pub missing_required_field: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct SetAgentQueueControlStateResultDto {
    pub status: String,
    pub control_state: Option<AgentQueueControlStateDto>,
    pub blocker: Option<AgentQueueControlCommandBlockerDto>,
}

impl From<SetAgentQueueControlStateRequest> for SetAgentQueueControlStateInput {
    fn from(request: SetAgentQueueControlStateRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            status: request.status,
            actor_id: request.actor_id,
            reason: request.reason,
            expected_version: request.expected_version,
        }
    }
}

impl From<AgentQueueControlStateSummary> for AgentQueueControlStateDto {
    fn from(summary: AgentQueueControlStateSummary) -> Self {
        Self {
            workspace_id: summary.workspace_id,
            status: summary.status,
            version: summary.version,
            updated_by_actor_id: summary.updated_by_actor_id,
            reason: summary.reason,
            created_at: summary.created_at,
            updated_at: summary.updated_at,
        }
    }
}

impl From<AgentQueueControlCommandBlocker> for AgentQueueControlCommandBlockerDto {
    fn from(blocker: AgentQueueControlCommandBlocker) -> Self {
        Self {
            blocker_code: blocker.blocker_code,
            blocker_message: blocker.blocker_message,
            expected_version: blocker.expected_version,
            actual_version: blocker.actual_version,
            missing_required_field: blocker.missing_required_field,
        }
    }
}

impl From<SetAgentQueueControlStateResult> for SetAgentQueueControlStateResultDto {
    fn from(result: SetAgentQueueControlStateResult) -> Self {
        Self {
            status: result.status.as_str().to_owned(),
            control_state: result.control_state.map(AgentQueueControlStateDto::from),
            blocker: result.blocker.map(AgentQueueControlCommandBlockerDto::from),
        }
    }
}
