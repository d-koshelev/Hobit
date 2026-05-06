use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use hobit_storage_sqlite::{NewWorkspaceSession, SqliteStore, WorkspaceRow};

use crate::WorkspaceServiceError;

static NEXT_ID_SUFFIX: AtomicU64 = AtomicU64::new(1);

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkspaceSummary {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub workbench_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkspaceSessionSummary {
    pub id: String,
    pub workspace_id: String,
    pub status: String,
    pub active_widget_id: Option<String>,
}

pub struct WorkspaceService {
    store: SqliteStore,
}

impl WorkspaceService {
    pub fn new(store: SqliteStore) -> Self {
        Self { store }
    }

    pub fn create_empty_workspace(
        &self,
        title: impl Into<String>,
        description: Option<String>,
    ) -> Result<WorkspaceSummary, WorkspaceServiceError> {
        let title = title.into();
        let title = title.trim();

        if title.is_empty() {
            return Err(WorkspaceServiceError::InvalidInput(
                "workspace title must not be empty".to_owned(),
            ));
        }

        let workspace_id = placeholder_id("ws_");
        let workbench_id = placeholder_id("wb_");

        let workspace =
            self.store
                .create_workspace(&workspace_id, title, description.as_deref(), "active")?;
        let workbench =
            self.store
                .create_workspace_workbench(&workbench_id, &workspace.id, None)?;

        let event_payload = format!("workbench_id={}", workbench.id);
        self.store.append_workbench_event(
            &placeholder_id("evt_"),
            &workspace.id,
            "workspace_created",
            "Workspace created",
            Some(&event_payload),
        )?;

        Ok(workspace_summary(&workspace, Some(workbench.id)))
    }

    pub fn get_workspace_summary(
        &self,
        workspace_id: &str,
    ) -> Result<Option<WorkspaceSummary>, WorkspaceServiceError> {
        let Some(workspace) = self.store.get_workspace(workspace_id)? else {
            return Ok(None);
        };

        let workbench_id = self.first_workbench_id(&workspace.id)?;
        Ok(Some(workspace_summary(&workspace, workbench_id)))
    }

    pub fn list_workspaces(&self) -> Result<Vec<WorkspaceSummary>, WorkspaceServiceError> {
        self.store
            .list_workspaces()?
            .into_iter()
            .map(|workspace| {
                let workbench_id = self.first_workbench_id(&workspace.id)?;
                Ok(workspace_summary(&workspace, workbench_id))
            })
            .collect()
    }

    pub fn open_workspace(
        &self,
        workspace_id: &str,
    ) -> Result<Option<WorkspaceSessionSummary>, WorkspaceServiceError> {
        if self.store.get_workspace(workspace_id)?.is_none() {
            return Ok(None);
        }

        let session_id = placeholder_id("wss_");
        let opened_at = placeholder_timestamp();
        let session = self.store.create_workspace_session(NewWorkspaceSession {
            id: &session_id,
            workspace_id,
            status: "open",
            opened_at: Some(&opened_at),
            closed_at: None,
            active_widget_id: None,
            current_focus_kind: None,
            current_focus_ref: None,
        })?;

        let event_payload = format!("session_id={}", session.id);
        self.store.append_workbench_event(
            &placeholder_id("evt_"),
            workspace_id,
            "workspace_opened",
            "Workspace opened",
            Some(&event_payload),
        )?;

        Ok(Some(WorkspaceSessionSummary {
            id: session.id,
            workspace_id: session.workspace_id,
            status: session.status,
            active_widget_id: session.active_widget_id,
        }))
    }

    fn first_workbench_id(
        &self,
        workspace_id: &str,
    ) -> Result<Option<String>, WorkspaceServiceError> {
        Ok(self
            .store
            .list_workspace_workbenches(workspace_id)?
            .into_iter()
            .next()
            .map(|workbench| workbench.id))
    }
}

fn workspace_summary(row: &WorkspaceRow, workbench_id: Option<String>) -> WorkspaceSummary {
    WorkspaceSummary {
        id: row.id.clone(),
        title: row.title.clone(),
        description: row.description.clone(),
        status: row.status.clone(),
        workbench_id,
    }
}

// Placeholder ID and timestamp strategy until Hobit selects a durable ID policy.
fn placeholder_id(prefix: &str) -> String {
    let suffix = NEXT_ID_SUFFIX.fetch_add(1, Ordering::Relaxed);
    format!("{prefix}{}_{}", unix_nanos(), suffix)
}

fn placeholder_timestamp() -> String {
    match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(duration) => format!("{}.{:09}", duration.as_secs(), duration.subsec_nanos()),
        Err(_) => "0.000000000".to_owned(),
    }
}

fn unix_nanos() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn initialized_service() -> WorkspaceService {
        let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
        store.init_schema().expect("initialize schema");
        WorkspaceService::new(store)
    }

    #[test]
    fn create_empty_workspace_creates_workspace_and_workbench() {
        let service = initialized_service();

        let summary = service
            .create_empty_workspace("Incident", Some("Investigate".to_owned()))
            .expect("create workspace");

        let workbench_id = summary.workbench_id.as_deref().expect("workbench id");
        let workbenches = service
            .store
            .list_workspace_workbenches(&summary.id)
            .expect("list workbenches");
        let widgets = service
            .store
            .list_widget_instances(&summary.id)
            .expect("list widgets");
        let events = service
            .store
            .list_workbench_events(&summary.id)
            .expect("list events");

        assert!(summary.id.starts_with("ws_"));
        assert_eq!(summary.title, "Incident");
        assert_eq!(summary.description.as_deref(), Some("Investigate"));
        assert_eq!(summary.status, "active");
        assert_eq!(workbenches.len(), 1);
        assert_eq!(workbench_id, workbenches[0].id);
        assert!(widgets.is_empty());
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].kind, "workspace_created");
    }

    #[test]
    fn list_workspaces_returns_created_workspace() {
        let service = initialized_service();
        let created = service
            .create_empty_workspace("Incident", None)
            .expect("create workspace");

        let workspaces = service.list_workspaces().expect("list workspaces");

        assert_eq!(workspaces, vec![created]);
    }

    #[test]
    fn get_workspace_summary_returns_none_for_missing_workspace() {
        let service = initialized_service();

        let summary = service
            .get_workspace_summary("missing")
            .expect("get workspace summary");

        assert!(summary.is_none());
    }

    #[test]
    fn open_workspace_creates_workspace_session() {
        let service = initialized_service();
        let workspace = service
            .create_empty_workspace("Incident", None)
            .expect("create workspace");

        let session = service
            .open_workspace(&workspace.id)
            .expect("open workspace")
            .expect("session summary");
        let stored_session = service
            .store
            .get_workspace_session(&session.id)
            .expect("get session")
            .expect("session row");
        let events = service
            .store
            .list_workbench_events(&workspace.id)
            .expect("list events");

        assert!(session.id.starts_with("wss_"));
        assert_eq!(session.workspace_id, workspace.id);
        assert_eq!(session.status, "open");
        assert_eq!(session.active_widget_id, None);
        assert_eq!(stored_session.id, session.id);
        assert_eq!(stored_session.workspace_id, session.workspace_id);
        assert!(events.iter().any(|event| event.kind == "workspace_opened"));
    }

    #[test]
    fn open_missing_workspace_returns_none() {
        let service = initialized_service();

        let session = service.open_workspace("missing").expect("open workspace");

        assert!(session.is_none());
    }

    #[test]
    fn create_empty_workspace_rejects_empty_title() {
        let service = initialized_service();

        let error = service
            .create_empty_workspace("   ", None)
            .expect_err("reject empty title");

        assert!(matches!(error, WorkspaceServiceError::InvalidInput(_)));
    }
}
