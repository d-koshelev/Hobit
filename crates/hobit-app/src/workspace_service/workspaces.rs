use std::path::Path;

use hobit_storage_sqlite::NewWorkspaceSession;

use crate::WorkspaceServiceError;

use super::{
    mapping::{workspace_summary, workspace_summary_row},
    placeholder_id, placeholder_timestamp,
    validation::required_input,
    WorkspaceDeletionSummary, WorkspaceService, WorkspaceSessionSummary, WorkspaceSummary,
};

impl WorkspaceService {
    pub fn create_empty_workspace(
        &self,
        title: impl Into<String>,
        description: Option<String>,
    ) -> Result<WorkspaceSummary, WorkspaceServiceError> {
        self.create_empty_workspace_with_root_path(title, description, None)
    }

    pub fn create_empty_workspace_with_root_path(
        &self,
        title: impl Into<String>,
        description: Option<String>,
        root_path: Option<String>,
    ) -> Result<WorkspaceSummary, WorkspaceServiceError> {
        let title = title.into();
        let title = title.trim();
        let root_path = normalize_workspace_root_path(root_path)?;

        if title.is_empty() {
            return Err(WorkspaceServiceError::InvalidInput(
                "workspace title must not be empty".to_owned(),
            ));
        }

        let workspace_id = placeholder_id("ws_");
        let workbench_id = placeholder_id("wb_");

        let (workspace, workbench) = self.store.with_immediate_transaction(|store| {
            let workspace = store.create_workspace_with_root_path(
                &workspace_id,
                title,
                description.as_deref(),
                root_path.as_deref(),
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

            Ok((workspace, workbench))
        })?;

        Ok(workspace_summary(&workspace, Some(workbench.id)))
    }

    pub fn get_workspace_summary(
        &self,
        workspace_id: &str,
    ) -> Result<Option<WorkspaceSummary>, WorkspaceServiceError> {
        Ok(self
            .store
            .get_workspace_summary_with_workbench(workspace_id)?
            .map(workspace_summary_row))
    }

    pub fn update_workspace_title(
        &self,
        workspace_id: &str,
        title: impl Into<String>,
    ) -> Result<Option<WorkspaceSummary>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let title = title.into();
        let title = required_input(&title, "workspace title")?;

        self.store
            .with_immediate_transaction(|store| {
                store.update_workspace_title(workspace_id, title)?;
                store.append_workbench_event(
                    &placeholder_id("evt_"),
                    workspace_id,
                    "workspace_renamed",
                    "Workspace renamed",
                    None,
                )?;
                store.get_workspace_summary_with_workbench(workspace_id)
            })
            .map(|summary| summary.map(workspace_summary_row))
            .map_err(|error| {
                if matches!(
                    error,
                    hobit_storage_sqlite::StorageError::QueryReturnedNoRows
                ) {
                    WorkspaceServiceError::InvalidInput(format!(
                        "workspace not found: {workspace_id}"
                    ))
                } else {
                    WorkspaceServiceError::from(error)
                }
            })
    }

    pub fn list_workspaces(&self) -> Result<Vec<WorkspaceSummary>, WorkspaceServiceError> {
        Ok(self
            .store
            .list_workspace_summaries_with_workbench()?
            .into_iter()
            .map(workspace_summary_row)
            .collect())
    }

    pub fn delete_workspace(
        &self,
        workspace_id: &str,
    ) -> Result<WorkspaceDeletionSummary, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let deleted_workspace_id = workspace_id.to_owned();
        let remaining_workspaces = self
            .store
            .with_immediate_transaction(|store| {
                if store.get_workspace(workspace_id)?.is_none() {
                    return Err(hobit_storage_sqlite::StorageError::QueryReturnedNoRows);
                }

                store.delete_workspace_and_local_data(workspace_id)?;
                store.list_workspace_summaries_with_workbench()
            })
            .map_err(|error| {
                if matches!(
                    error,
                    hobit_storage_sqlite::StorageError::QueryReturnedNoRows
                ) {
                    WorkspaceServiceError::InvalidInput(format!(
                        "workspace not found: {workspace_id}"
                    ))
                } else {
                    WorkspaceServiceError::from(error)
                }
            })?
            .into_iter()
            .map(workspace_summary_row)
            .collect();

        Ok(WorkspaceDeletionSummary {
            deleted_workspace_id,
            deleted: true,
            remaining_workspaces,
        })
    }

    pub fn open_workspace(
        &self,
        workspace_id: &str,
    ) -> Result<Option<WorkspaceSessionSummary>, WorkspaceServiceError> {
        let Some(workspace) = self.store.get_workspace(workspace_id)? else {
            return Ok(None);
        };

        let session_id = placeholder_id("wss_");
        let opened_at = placeholder_timestamp();
        let session = self.store.with_immediate_transaction(|store| {
            let session = store.create_workspace_session(NewWorkspaceSession {
                id: &session_id,
                workspace_id: &workspace.id,
                status: "open",
                opened_at: Some(&opened_at),
                closed_at: None,
                active_widget_id: None,
                current_focus_kind: None,
                current_focus_ref: None,
            })?;
            store.touch_workspace(&workspace.id)?;

            let event_payload = format!("session_id={}", session.id);
            store.append_workbench_event(
                &placeholder_id("evt_"),
                &workspace.id,
                "workspace_opened",
                "Workspace opened",
                Some(&event_payload),
            )?;

            Ok(session)
        })?;

        Ok(Some(WorkspaceSessionSummary {
            id: session.id,
            workspace_id: session.workspace_id,
            status: session.status,
            active_widget_id: session.active_widget_id,
        }))
    }
}

fn normalize_workspace_root_path(
    root_path: Option<String>,
) -> Result<Option<String>, WorkspaceServiceError> {
    let Some(root_path) = root_path else {
        return Ok(None);
    };
    let trimmed = root_path.trim();

    if trimmed.is_empty() || trimmed == "~" || trimmed == "." {
        return Err(WorkspaceServiceError::InvalidInput(
            "workspace root path must be an existing absolute directory".to_owned(),
        ));
    }

    let path = Path::new(trimmed);
    if !path.is_absolute() {
        return Err(WorkspaceServiceError::InvalidInput(
            "workspace root path must be absolute".to_owned(),
        ));
    }
    if !path.is_dir() {
        return Err(WorkspaceServiceError::InvalidInput(
            "workspace root path must be an existing directory".to_owned(),
        ));
    }

    Ok(Some(trimmed.to_owned()))
}
