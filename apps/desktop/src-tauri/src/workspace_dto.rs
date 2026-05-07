use hobit_app::{
    SharedStateObjectSummary, WidgetInstanceSummary, WorkbenchEventSummary, WorkbenchSummary,
    WorkspaceSessionSummary, WorkspaceSummary, WorkspaceWorkbenchState,
};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct CreateWorkspaceRequest {
    pub title: String,
    pub description: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct WorkspaceSummaryDto {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub workbench_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct WorkspaceSessionSummaryDto {
    pub id: String,
    pub workspace_id: String,
    pub status: String,
    pub active_widget_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct WorkspaceWorkbenchStateDto {
    pub workspace: WorkspaceSummaryDto,
    pub workbench: Option<WorkbenchSummaryDto>,
    pub widget_instances: Vec<WidgetInstanceSummaryDto>,
    pub shared_state_objects: Vec<SharedStateObjectSummaryDto>,
    pub recent_events: Vec<WorkbenchEventSummaryDto>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct WorkbenchSummaryDto {
    pub id: String,
    pub workspace_id: String,
    pub preset_origin_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct WidgetInstanceSummaryDto {
    pub id: String,
    pub definition_id: String,
    pub title: String,
    pub category: String,
    pub layout_mode: String,
    pub is_visible: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct SharedStateObjectSummaryDto {
    pub id: String,
    pub key: String,
    pub value: String,
    pub value_kind: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct WorkbenchEventSummaryDto {
    pub id: String,
    pub kind: String,
    pub summary: String,
    pub created_at: String,
}

impl From<WorkspaceSummary> for WorkspaceSummaryDto {
    fn from(summary: WorkspaceSummary) -> Self {
        Self {
            id: summary.id,
            title: summary.title,
            description: summary.description,
            status: summary.status,
            workbench_id: summary.workbench_id,
        }
    }
}

impl From<WorkspaceSessionSummary> for WorkspaceSessionSummaryDto {
    fn from(summary: WorkspaceSessionSummary) -> Self {
        Self {
            id: summary.id,
            workspace_id: summary.workspace_id,
            status: summary.status,
            active_widget_id: summary.active_widget_id,
        }
    }
}

impl From<WorkspaceWorkbenchState> for WorkspaceWorkbenchStateDto {
    fn from(state: WorkspaceWorkbenchState) -> Self {
        Self {
            workspace: WorkspaceSummaryDto::from(state.workspace),
            workbench: state.workbench.map(WorkbenchSummaryDto::from),
            widget_instances: state
                .widget_instances
                .into_iter()
                .map(WidgetInstanceSummaryDto::from)
                .collect(),
            shared_state_objects: state
                .shared_state_objects
                .into_iter()
                .map(SharedStateObjectSummaryDto::from)
                .collect(),
            recent_events: state
                .recent_events
                .into_iter()
                .map(WorkbenchEventSummaryDto::from)
                .collect(),
        }
    }
}

impl From<WorkbenchSummary> for WorkbenchSummaryDto {
    fn from(summary: WorkbenchSummary) -> Self {
        Self {
            id: summary.id,
            workspace_id: summary.workspace_id,
            preset_origin_id: summary.preset_origin_id,
        }
    }
}

impl From<WidgetInstanceSummary> for WidgetInstanceSummaryDto {
    fn from(summary: WidgetInstanceSummary) -> Self {
        Self {
            id: summary.id,
            definition_id: summary.definition_id,
            title: summary.title,
            category: summary.category,
            layout_mode: summary.layout_mode,
            is_visible: summary.is_visible,
        }
    }
}

impl From<SharedStateObjectSummary> for SharedStateObjectSummaryDto {
    fn from(summary: SharedStateObjectSummary) -> Self {
        Self {
            id: summary.id,
            key: summary.key,
            value: summary.value,
            value_kind: summary.value_kind,
        }
    }
}

impl From<WorkbenchEventSummary> for WorkbenchEventSummaryDto {
    fn from(summary: WorkbenchEventSummary) -> Self {
        Self {
            id: summary.id,
            kind: summary.kind,
            summary: summary.summary,
            created_at: summary.created_at,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_workspace_summary_to_dto() {
        let summary = WorkspaceSummary {
            id: "ws_1".to_owned(),
            title: "Incident".to_owned(),
            description: Some("Investigate".to_owned()),
            status: "active".to_owned(),
            workbench_id: Some("wb_1".to_owned()),
        };

        let dto = WorkspaceSummaryDto::from(summary);

        assert_eq!(
            dto,
            WorkspaceSummaryDto {
                id: "ws_1".to_owned(),
                title: "Incident".to_owned(),
                description: Some("Investigate".to_owned()),
                status: "active".to_owned(),
                workbench_id: Some("wb_1".to_owned()),
            }
        );
    }

    #[test]
    fn maps_workspace_session_summary_to_dto() {
        let summary = WorkspaceSessionSummary {
            id: "wss_1".to_owned(),
            workspace_id: "ws_1".to_owned(),
            status: "open".to_owned(),
            active_widget_id: None,
        };

        let dto = WorkspaceSessionSummaryDto::from(summary);

        assert_eq!(
            dto,
            WorkspaceSessionSummaryDto {
                id: "wss_1".to_owned(),
                workspace_id: "ws_1".to_owned(),
                status: "open".to_owned(),
                active_widget_id: None,
            }
        );
    }

    #[test]
    fn maps_workspace_workbench_state_to_dto() {
        let state = WorkspaceWorkbenchState {
            workspace: WorkspaceSummary {
                id: "ws_1".to_owned(),
                title: "Incident".to_owned(),
                description: None,
                status: "active".to_owned(),
                workbench_id: Some("wb_1".to_owned()),
            },
            workbench: Some(WorkbenchSummary {
                id: "wb_1".to_owned(),
                workspace_id: "ws_1".to_owned(),
                preset_origin_id: None,
            }),
            widget_instances: vec![WidgetInstanceSummary {
                id: "widget-1".to_owned(),
                definition_id: "notes".to_owned(),
                title: "Notes".to_owned(),
                category: "notes".to_owned(),
                layout_mode: "docked".to_owned(),
                is_visible: true,
            }],
            shared_state_objects: vec![SharedStateObjectSummary {
                id: "shared-1".to_owned(),
                key: "current_goal".to_owned(),
                value: "Investigate".to_owned(),
                value_kind: "text".to_owned(),
            }],
            recent_events: vec![WorkbenchEventSummary {
                id: "event-1".to_owned(),
                kind: "workspace_created".to_owned(),
                summary: "Workspace created".to_owned(),
                created_at: "1".to_owned(),
            }],
        };

        let dto = WorkspaceWorkbenchStateDto::from(state);

        assert_eq!(dto.workspace.id, "ws_1");
        assert_eq!(
            dto.workbench
                .as_ref()
                .map(|workbench| workbench.id.as_str()),
            Some("wb_1")
        );
        assert_eq!(dto.widget_instances[0].definition_id, "notes");
        assert_eq!(dto.shared_state_objects[0].key, "current_goal");
        assert_eq!(dto.recent_events[0].kind, "workspace_created");
    }
}
