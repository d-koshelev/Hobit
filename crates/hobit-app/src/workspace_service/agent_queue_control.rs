use hobit_storage_sqlite::{
    AgentQueueControlStateRow, AgentQueueControlStateUpdate, NewAgentQueueControlState,
};

use crate::WorkspaceServiceError;

use super::{placeholder_timestamp, validation::required_input, WorkspaceService};

pub const AGENT_QUEUE_CONTROL_STATUS_DISABLED: &str = "disabled";
pub const AGENT_QUEUE_CONTROL_STATUS_MANUAL_ENABLED: &str = "manual_enabled";
const DEFAULT_AGENT_QUEUE_CONTROL_VERSION: i64 = 1;
const MAX_AGENT_QUEUE_CONTROL_REASON_CHARS: usize = 512;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentQueueControlStateSummary {
    pub workspace_id: String,
    pub status: String,
    pub version: i64,
    pub updated_by_actor_id: Option<String>,
    pub reason: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SetAgentQueueControlStateInput {
    pub workspace_id: String,
    pub status: String,
    pub actor_id: Option<String>,
    pub reason: Option<String>,
    pub expected_version: Option<i64>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AgentQueueControlCommandStatus {
    Succeeded,
    AlreadyInState,
    InvalidInput,
    WorkspaceNotFound,
    VersionConflict,
}

impl AgentQueueControlCommandStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Succeeded => "succeeded",
            Self::AlreadyInState => "already_in_state",
            Self::InvalidInput => "invalid_input",
            Self::WorkspaceNotFound => "workspace_not_found",
            Self::VersionConflict => "version_conflict",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentQueueControlCommandBlocker {
    pub blocker_code: String,
    pub blocker_message: String,
    pub expected_version: Option<i64>,
    pub actual_version: Option<i64>,
    pub missing_required_field: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SetAgentQueueControlStateResult {
    pub status: AgentQueueControlCommandStatus,
    pub control_state: Option<AgentQueueControlStateSummary>,
    pub blocker: Option<AgentQueueControlCommandBlocker>,
}

impl WorkspaceService {
    pub fn get_agent_queue_control_state(
        &self,
        workspace_id: &str,
    ) -> Result<Option<AgentQueueControlStateSummary>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;

        let control = self.store.with_immediate_transaction(|store| {
            if store.get_workspace(workspace_id)?.is_none() {
                return Ok(None);
            }

            Ok(Some(ensure_default_control_state(store, workspace_id)?))
        })?;

        Ok(control.map(agent_queue_control_state_summary))
    }

    pub fn set_agent_queue_control_state(
        &self,
        input: SetAgentQueueControlStateInput,
    ) -> Result<SetAgentQueueControlStateResult, WorkspaceServiceError> {
        let input = match normalize_control_input(input) {
            Ok(input) => input,
            Err(blocker) => return Ok(control_command_blocked(blocker)),
        };

        let result = self.store.with_immediate_transaction(|store| {
            if store.get_workspace(&input.workspace_id)?.is_none() {
                return Ok(SetAgentQueueControlStateResult {
                    status: AgentQueueControlCommandStatus::WorkspaceNotFound,
                    control_state: None,
                    blocker: Some(AgentQueueControlCommandBlocker {
                        blocker_code: "workspace_not_found".to_owned(),
                        blocker_message: format!("workspace not found: {}", input.workspace_id),
                        expected_version: input.expected_version,
                        actual_version: None,
                        missing_required_field: None,
                    }),
                });
            }

            let existing = ensure_default_control_state(store, &input.workspace_id)?;

            if let Some(expected_version) = input.expected_version {
                if existing.version != expected_version {
                    return Ok(SetAgentQueueControlStateResult {
                        status: AgentQueueControlCommandStatus::VersionConflict,
                        control_state: Some(agent_queue_control_state_summary(existing.clone())),
                        blocker: Some(AgentQueueControlCommandBlocker {
                            blocker_code: "version_conflict".to_owned(),
                            blocker_message: format!(
                                "Queue control state version conflict: expected {expected_version}, actual {}.",
                                existing.version
                            ),
                            expected_version: Some(expected_version),
                            actual_version: Some(existing.version),
                            missing_required_field: None,
                        }),
                    });
                }
            }

            if existing.status == input.status {
                return Ok(SetAgentQueueControlStateResult {
                    status: AgentQueueControlCommandStatus::AlreadyInState,
                    control_state: Some(agent_queue_control_state_summary(existing)),
                    blocker: None,
                });
            }

            let updated_at = placeholder_timestamp();
            let updated = store
                .update_agent_queue_control_state(
                    &input.workspace_id,
                    AgentQueueControlStateUpdate {
                        status: &input.status,
                        updated_by_actor_id: input.actor_id.as_deref(),
                        reason: input.reason.as_deref(),
                        updated_at: Some(&updated_at),
                    },
                )?
                .ok_or(hobit_storage_sqlite::StorageError::QueryReturnedNoRows)?;

            Ok(SetAgentQueueControlStateResult {
                status: AgentQueueControlCommandStatus::Succeeded,
                control_state: Some(agent_queue_control_state_summary(updated)),
                blocker: None,
            })
        })?;

        Ok(result)
    }

    pub fn enable_agent_queue_manual_control(
        &self,
        workspace_id: String,
        actor_id: Option<String>,
        reason: Option<String>,
        expected_version: Option<i64>,
    ) -> Result<SetAgentQueueControlStateResult, WorkspaceServiceError> {
        self.set_agent_queue_control_state(SetAgentQueueControlStateInput {
            workspace_id,
            status: AGENT_QUEUE_CONTROL_STATUS_MANUAL_ENABLED.to_owned(),
            actor_id,
            reason,
            expected_version,
        })
    }

    pub fn disable_agent_queue_control(
        &self,
        workspace_id: String,
        actor_id: Option<String>,
        reason: Option<String>,
        expected_version: Option<i64>,
    ) -> Result<SetAgentQueueControlStateResult, WorkspaceServiceError> {
        self.set_agent_queue_control_state(SetAgentQueueControlStateInput {
            workspace_id,
            status: AGENT_QUEUE_CONTROL_STATUS_DISABLED.to_owned(),
            actor_id,
            reason,
            expected_version,
        })
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedControlInput {
    workspace_id: String,
    status: String,
    actor_id: Option<String>,
    reason: Option<String>,
    expected_version: Option<i64>,
}

fn normalize_control_input(
    input: SetAgentQueueControlStateInput,
) -> Result<NormalizedControlInput, AgentQueueControlCommandBlocker> {
    let workspace_id = required_field(input.workspace_id, "workspace_id")?;
    let status = required_field(input.status, "status")?;
    let status = match status.as_str() {
        AGENT_QUEUE_CONTROL_STATUS_DISABLED => AGENT_QUEUE_CONTROL_STATUS_DISABLED.to_owned(),
        AGENT_QUEUE_CONTROL_STATUS_MANUAL_ENABLED => {
            AGENT_QUEUE_CONTROL_STATUS_MANUAL_ENABLED.to_owned()
        }
        _ => {
            return Err(AgentQueueControlCommandBlocker {
                blocker_code: "unsupported_status".to_owned(),
                blocker_message: format!("unsupported Queue control status: {status}"),
                expected_version: input.expected_version,
                actual_version: None,
                missing_required_field: Some("status".to_owned()),
            });
        }
    };

    let actor_id = normalize_optional_string(input.actor_id, "actor_id", 128)?;
    let reason =
        normalize_optional_string(input.reason, "reason", MAX_AGENT_QUEUE_CONTROL_REASON_CHARS)?;

    if input.expected_version.is_some_and(|version| version < 0) {
        return Err(AgentQueueControlCommandBlocker {
            blocker_code: "invalid_expected_version".to_owned(),
            blocker_message: "expected_version must not be negative.".to_owned(),
            expected_version: input.expected_version,
            actual_version: None,
            missing_required_field: Some("expected_version".to_owned()),
        });
    }

    Ok(NormalizedControlInput {
        workspace_id,
        status,
        actor_id,
        reason,
        expected_version: input.expected_version,
    })
}

fn ensure_default_control_state(
    store: &hobit_storage_sqlite::SqliteStore,
    workspace_id: &str,
) -> Result<AgentQueueControlStateRow, hobit_storage_sqlite::StorageError> {
    let created_at = placeholder_timestamp();
    store.ensure_agent_queue_control_state(NewAgentQueueControlState {
        workspace_id,
        status: AGENT_QUEUE_CONTROL_STATUS_DISABLED,
        version: DEFAULT_AGENT_QUEUE_CONTROL_VERSION,
        updated_by_actor_id: None,
        reason: None,
        created_at: Some(&created_at),
        updated_at: Some(&created_at),
    })
}

fn agent_queue_control_state_summary(
    row: AgentQueueControlStateRow,
) -> AgentQueueControlStateSummary {
    AgentQueueControlStateSummary {
        workspace_id: row.workspace_id,
        status: row.status,
        version: row.version,
        updated_by_actor_id: row.updated_by_actor_id,
        reason: row.reason,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

fn control_command_blocked(
    blocker: AgentQueueControlCommandBlocker,
) -> SetAgentQueueControlStateResult {
    SetAgentQueueControlStateResult {
        status: AgentQueueControlCommandStatus::InvalidInput,
        control_state: None,
        blocker: Some(blocker),
    }
}

fn required_field(value: String, field: &str) -> Result<String, AgentQueueControlCommandBlocker> {
    let value = value.trim().to_owned();
    if value.is_empty() {
        return Err(AgentQueueControlCommandBlocker {
            blocker_code: "missing_required_field".to_owned(),
            blocker_message: format!("{field} is required."),
            expected_version: None,
            actual_version: None,
            missing_required_field: Some(field.to_owned()),
        });
    }

    Ok(value)
}

fn normalize_optional_string(
    value: Option<String>,
    field: &str,
    max_chars: usize,
) -> Result<Option<String>, AgentQueueControlCommandBlocker> {
    let Some(value) = value else {
        return Ok(None);
    };
    let value = value.trim().to_owned();
    if value.is_empty() {
        return Ok(None);
    }
    if value.chars().count() > max_chars {
        return Err(AgentQueueControlCommandBlocker {
            blocker_code: "input_too_large".to_owned(),
            blocker_message: format!("{field} must be no longer than {max_chars} characters."),
            expected_version: None,
            actual_version: None,
            missing_required_field: Some(field.to_owned()),
        });
    }

    Ok(Some(value))
}
