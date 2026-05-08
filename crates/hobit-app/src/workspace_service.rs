use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use hobit_storage_sqlite::{
    NewWorkspaceSession, SharedStateObjectRow, SqliteStore, WidgetInstanceRow, WorkbenchEventRow,
    WorkspaceRow, WorkspaceWorkbenchRow,
};

use crate::WorkspaceServiceError;

static NEXT_ID_SUFFIX: AtomicU64 = AtomicU64::new(1);
const WORKBENCH_STATE_RECENT_EVENT_LIMIT: usize = 100;

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

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkspaceWorkbenchState {
    pub workspace: WorkspaceSummary,
    pub workbench: Option<WorkbenchSummary>,
    pub widget_instances: Vec<WidgetInstanceSummary>,
    pub shared_state_objects: Vec<SharedStateObjectSummary>,
    pub recent_events: Vec<WorkbenchEventSummary>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkbenchSummary {
    pub id: String,
    pub workspace_id: String,
    pub preset_origin_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetInstanceSummary {
    pub id: String,
    pub definition_id: String,
    pub title: String,
    pub category: String,
    pub layout_mode: String,
    pub dock_x: Option<i64>,
    pub dock_y: Option<i64>,
    pub dock_width: Option<i64>,
    pub dock_height: Option<i64>,
    pub popout_x: Option<i64>,
    pub popout_y: Option<i64>,
    pub popout_width: Option<i64>,
    pub popout_height: Option<i64>,
    pub always_on_top: bool,
    pub is_visible: bool,
    pub config: Option<String>,
    pub state: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SharedStateObjectSummary {
    pub id: String,
    pub key: String,
    pub value: String,
    pub value_kind: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkbenchEventSummary {
    pub id: String,
    pub kind: String,
    pub summary: String,
    pub created_at: String,
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
        self.store.touch_workspace(workspace_id)?;

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

    pub fn get_workspace_workbench_state(
        &self,
        workspace_id: &str,
    ) -> Result<Option<WorkspaceWorkbenchState>, WorkspaceServiceError> {
        let Some(workspace) = self.store.get_workspace(workspace_id)? else {
            return Ok(None);
        };

        let workbench = self
            .store
            .list_workspace_workbenches(&workspace.id)?
            .into_iter()
            .next();
        let workbench_id = workbench.as_ref().map(|workbench| workbench.id.clone());
        let widget_instances = match workbench.as_ref() {
            Some(workbench) => self
                .store
                .list_widget_instances_for_workbench(&workbench.id)?
                .into_iter()
                .map(widget_instance_summary)
                .collect(),
            None => Vec::new(),
        };
        let shared_state_objects = self
            .store
            .list_shared_state_objects(&workspace.id)?
            .into_iter()
            .map(shared_state_object_summary)
            .collect();
        let recent_events = match workbench_id.as_deref() {
            Some(workbench_id) => self
                .store
                .list_recent_workbench_events(workbench_id, WORKBENCH_STATE_RECENT_EVENT_LIMIT)?
                .into_iter()
                .map(workbench_event_summary)
                .collect(),
            None => Vec::new(),
        };

        Ok(Some(WorkspaceWorkbenchState {
            workspace: workspace_summary(&workspace, workbench_id),
            workbench: workbench.map(workbench_summary),
            widget_instances,
            shared_state_objects,
            recent_events,
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

fn workbench_summary(row: WorkspaceWorkbenchRow) -> WorkbenchSummary {
    WorkbenchSummary {
        id: row.id,
        workspace_id: row.workspace_id,
        preset_origin_id: row.preset_origin_id,
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

fn widget_instance_summary(row: WidgetInstanceRow) -> WidgetInstanceSummary {
    WidgetInstanceSummary {
        id: row.id,
        definition_id: row.definition_id,
        title: row.title,
        category: row.category,
        layout_mode: row.layout_mode,
        dock_x: row.dock_x,
        dock_y: row.dock_y,
        dock_width: row.dock_width,
        dock_height: row.dock_height,
        popout_x: row.popout_x,
        popout_y: row.popout_y,
        popout_width: row.popout_width,
        popout_height: row.popout_height,
        always_on_top: row.always_on_top,
        is_visible: row.is_visible,
        config: row.config,
        state: row.state,
    }
}

fn shared_state_object_summary(row: SharedStateObjectRow) -> SharedStateObjectSummary {
    SharedStateObjectSummary {
        id: row.id,
        key: row.key,
        value: row.value,
        value_kind: row.value_kind,
    }
}

fn workbench_event_summary(row: WorkbenchEventRow) -> WorkbenchEventSummary {
    WorkbenchEventSummary {
        id: row.id,
        kind: row.kind,
        summary: row.summary,
        created_at: row.created_at,
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
    use hobit_storage_sqlite::{NewSharedStateObject, NewWidgetInstance};

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
    fn open_workspace_moves_it_to_recent_workspaces_front() {
        let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
        store.init_schema().expect("initialize schema");
        store
            .create_workspace("workspace-z-older", "Older", None, "active")
            .expect("create older workspace");
        store
            .create_workspace_workbench("workbench-older", "workspace-z-older", None)
            .expect("create older workbench");
        store
            .create_workspace("workspace-a-newer", "Newer", None, "active")
            .expect("create newer workspace");
        store
            .create_workspace_workbench("workbench-newer", "workspace-a-newer", None)
            .expect("create newer workbench");
        let service = WorkspaceService::new(store);

        let initial_workspaces = service.list_workspaces().expect("list workspaces");
        assert_eq!(
            workspace_ids(&initial_workspaces),
            vec!["workspace-a-newer", "workspace-z-older"]
        );

        service
            .open_workspace("workspace-z-older")
            .expect("open workspace")
            .expect("session summary");

        let recent_workspaces = service.list_workspaces().expect("list workspaces");
        assert_eq!(
            workspace_ids(&recent_workspaces),
            vec!["workspace-z-older", "workspace-a-newer"]
        );
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

    #[test]
    fn get_workbench_state_returns_none_for_missing_workspace() {
        let service = initialized_service();

        let state = service
            .get_workspace_workbench_state("missing")
            .expect("get workbench state");

        assert!(state.is_none());
    }

    #[test]
    fn get_workbench_state_for_empty_workspace_has_empty_widgets() {
        let service = initialized_service();
        let workspace = service
            .create_empty_workspace("Incident", None)
            .expect("create workspace");

        let state = service
            .get_workspace_workbench_state(&workspace.id)
            .expect("get workbench state")
            .expect("workbench state");

        assert_eq!(state.workspace, workspace);
        assert_eq!(
            state
                .workbench
                .as_ref()
                .map(|workbench| workbench.id.as_str()),
            state.workspace.workbench_id.as_deref()
        );
        assert!(state.widget_instances.is_empty());
        assert!(state.shared_state_objects.is_empty());
        assert_eq!(state.recent_events.len(), 1);
        assert_eq!(state.recent_events[0].kind, "workspace_created");
    }

    #[test]
    fn get_workbench_state_includes_shared_state_and_events() {
        let service = initialized_service();
        let workspace = service
            .create_empty_workspace("Incident", None)
            .expect("create workspace");

        service
            .store
            .insert_shared_state_object(NewSharedStateObject {
                id: "shared-1",
                workspace_id: &workspace.id,
                key: "current_goal",
                value: "Investigate outage",
                value_kind: "text",
            })
            .expect("insert shared state");
        service
            .store
            .append_workbench_event(
                "event-1",
                &workspace.id,
                "shared_state_changed",
                "Shared state changed",
                Some("shared_state_id=shared-1"),
            )
            .expect("append event");

        let state = service
            .get_workspace_workbench_state(&workspace.id)
            .expect("get workbench state")
            .expect("workbench state");

        assert_eq!(
            state.shared_state_objects,
            vec![SharedStateObjectSummary {
                id: "shared-1".to_owned(),
                key: "current_goal".to_owned(),
                value: "Investigate outage".to_owned(),
                value_kind: "text".to_owned(),
            }]
        );
        assert!(state
            .recent_events
            .iter()
            .any(|event| event.kind == "shared_state_changed"));
    }

    #[test]
    fn get_workbench_state_includes_widget_instances() {
        let service = initialized_service();
        let workspace = service
            .create_empty_workspace("Incident", None)
            .expect("create workspace");
        let workbench_id = workspace
            .workbench_id
            .as_deref()
            .expect("created workbench id");
        service
            .store
            .create_workspace_workbench("zz-other-workbench", &workspace.id, None)
            .expect("create other workbench");

        service
            .store
            .insert_widget_instance(NewWidgetInstance {
                id: "widget-1",
                workspace_id: &workspace.id,
                workbench_id,
                definition_id: "notes",
                title: "Notes",
                category: "notes",
                layout_mode: "docked",
                dock_x: Some(12),
                dock_y: Some(24),
                dock_width: Some(480),
                dock_height: Some(320),
                popout_x: Some(120),
                popout_y: Some(140),
                popout_width: Some(640),
                popout_height: Some(480),
                always_on_top: true,
                is_visible: true,
                config: Some("{\"scope\":\"workspace\"}"),
                state: Some("{\"dirty\":false}"),
            })
            .expect("insert widget");
        service
            .store
            .insert_widget_instance(NewWidgetInstance {
                id: "widget-2",
                workspace_id: &workspace.id,
                workbench_id: "zz-other-workbench",
                definition_id: "notes",
                title: "Other Notes",
                category: "notes",
                layout_mode: "docked",
                dock_x: Some(0),
                dock_y: Some(0),
                dock_width: Some(320),
                dock_height: Some(240),
                popout_x: None,
                popout_y: None,
                popout_width: None,
                popout_height: None,
                always_on_top: false,
                is_visible: true,
                config: None,
                state: None,
            })
            .expect("insert other workbench widget");

        let state = service
            .get_workspace_workbench_state(&workspace.id)
            .expect("get workbench state")
            .expect("workbench state");

        assert_eq!(
            state.widget_instances,
            vec![WidgetInstanceSummary {
                id: "widget-1".to_owned(),
                definition_id: "notes".to_owned(),
                title: "Notes".to_owned(),
                category: "notes".to_owned(),
                layout_mode: "docked".to_owned(),
                dock_x: Some(12),
                dock_y: Some(24),
                dock_width: Some(480),
                dock_height: Some(320),
                popout_x: Some(120),
                popout_y: Some(140),
                popout_width: Some(640),
                popout_height: Some(480),
                always_on_top: true,
                is_visible: true,
                config: Some("{\"scope\":\"workspace\"}".to_owned()),
                state: Some("{\"dirty\":false}".to_owned()),
            }]
        );
    }

    fn workspace_ids(workspaces: &[WorkspaceSummary]) -> Vec<&str> {
        workspaces
            .iter()
            .map(|workspace| workspace.id.as_str())
            .collect()
    }
}
