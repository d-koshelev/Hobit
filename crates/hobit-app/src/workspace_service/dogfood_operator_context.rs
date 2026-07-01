use std::{fs, path::Path};

use crate::WorkspaceServiceError;

use super::{
    agent_queue_control::{
        ensure_default_control_state, AGENT_QUEUE_CONTROL_STATUS_MANUAL_ENABLED,
    },
    mapping::workspace_summary_row,
    placeholder_id, placeholder_timestamp,
    validation::required_input,
    WorkspaceService,
};

const DOGFOOD_OPERATOR_WORKSPACE_TITLE: &str = "Queue Dogfood Operator";
const DOGFOOD_OPERATOR_WORKSPACE_DESCRIPTION: &str =
    "Dedicated workspace for backend-owned Queue dogfood prompt-pack runs.";

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DogfoodOperatorWorkspaceContextSummary {
    pub workspace_id: String,
    pub workspace_resolution_method: String,
    pub workspace_root: String,
    pub dogfood_binding_reused: bool,
    pub dogfood_workspace_created: bool,
    pub warnings: Vec<String>,
}

impl WorkspaceService {
    pub fn ensure_dogfood_operator_workspace_for_root(
        &self,
        canonical_root_key: &str,
        workspace_root: &str,
    ) -> Result<DogfoodOperatorWorkspaceContextSummary, WorkspaceServiceError> {
        let canonical_root_key = required_input(canonical_root_key, "canonical root")?;
        let workspace_root = required_input(workspace_root, "workspace root")?;

        let ensured = self.store.with_immediate_transaction(|store| {
            if let Some(bound_workspace_id) =
                store.get_dogfood_operator_workspace_binding(canonical_root_key)?
            {
                let workspace = store
                    .get_workspace_summary_with_workbench(&bound_workspace_id)?
                    .ok_or(hobit_storage_sqlite::StorageError::QueryReturnedNoRows)?;
                return Ok((
                    workspace_summary_row(workspace),
                    "persisted_dogfood_binding".to_owned(),
                    true,
                    false,
                ));
            }

            let workspace_id = placeholder_id("ws_");
            let workbench_id = placeholder_id("wb_");
            let workspace = store.create_workspace_with_root_path(
                &workspace_id,
                DOGFOOD_OPERATOR_WORKSPACE_TITLE,
                Some(DOGFOOD_OPERATOR_WORKSPACE_DESCRIPTION),
                Some(workspace_root),
                "active",
            )?;
            let workbench = store.create_workspace_workbench(&workbench_id, &workspace.id, None)?;

            let event_payload = format!("workbench_id={}", workbench.id);
            store.append_workbench_event(
                &placeholder_id("evt_"),
                &workspace.id,
                "workspace_created",
                "Workspace created",
                Some(&event_payload),
            )?;

            let control = ensure_default_control_state(store, &workspace.id)?;
            if control.status != AGENT_QUEUE_CONTROL_STATUS_MANUAL_ENABLED {
                store.update_agent_queue_control_state(
                    &workspace.id,
                    hobit_storage_sqlite::AgentQueueControlStateUpdate {
                        status: AGENT_QUEUE_CONTROL_STATUS_MANUAL_ENABLED,
                        updated_by_actor_id: Some("dogfood-operator"),
                        reason: Some("Dedicated Queue dogfood operator workspace."),
                        updated_at: Some(&placeholder_timestamp()),
                    },
                )?;
            }

            store.upsert_dogfood_operator_workspace_binding(canonical_root_key, &workspace.id)?;

            let workspace = store
                .get_workspace_summary_with_workbench(&workspace.id)?
                .ok_or(hobit_storage_sqlite::StorageError::QueryReturnedNoRows)?;
            Ok((
                workspace_summary_row(workspace),
                "ensure_dogfood_workspace".to_owned(),
                false,
                true,
            ))
        })?;

        let (
            workspace,
            workspace_resolution_method,
            dogfood_binding_reused,
            dogfood_workspace_created,
        ) = ensured;
        let mut warnings = Vec::new();
        if !workspace_matches_canonical_root(workspace.root_path.as_deref(), canonical_root_key) {
            warnings.push(
                "dogfood workspace binding exists but the workspace root no longer canonicalizes to the operator root"
                    .to_owned(),
            );
        }

        Ok(DogfoodOperatorWorkspaceContextSummary {
            workspace_id: workspace.id,
            workspace_resolution_method,
            workspace_root: workspace_root.to_owned(),
            dogfood_binding_reused,
            dogfood_workspace_created,
            warnings,
        })
    }
}

fn workspace_matches_canonical_root(root_path: Option<&str>, canonical_root_key: &str) -> bool {
    let Some(root_path) = root_path else {
        return false;
    };
    fs::canonicalize(root_path)
        .map(|root| canonical_path_key(&root) == canonical_root_key)
        .unwrap_or(false)
}

fn canonical_path_key(path: &Path) -> String {
    let normalized = path.display().to_string().replace('\\', "/");
    if cfg!(windows) {
        normalized.to_ascii_lowercase()
    } else {
        normalized
    }
}
