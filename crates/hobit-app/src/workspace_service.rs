use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use std::{path::Path, path::PathBuf};

use hobit_core::widgets::WidgetRunStatus;
use hobit_storage_sqlite::{
    NewWidgetInstance, NewWidgetLog, NewWidgetResult, NewWidgetRun, NewWorkspaceSession,
    SharedStateObjectRow, SqliteStore, StorageError, WidgetInstanceLayoutUpdate, WidgetInstanceRow,
    WidgetLogRow, WidgetResultRow, WidgetRunFinishUpdate, WidgetRunRow, WorkbenchEventRow,
    WorkspaceRow, WorkspaceSummaryRow, WorkspaceWorkbenchRow,
};
use hobit_tools::git::{
    read_git_repository_status, GitBranchSummary as ToolsGitBranchSummary,
    GitFileChange as ToolsGitFileChange, GitFileChangeArea, GitFileChangeKind,
    GitLastCommitSummary as ToolsGitLastCommitSummary,
    GitRepositoryStatus as ToolsGitRepositoryStatus, GitStatusError,
    GitWorkingTreeSummary as ToolsGitWorkingTreeSummary,
};

use crate::WorkspaceServiceError;

static NEXT_ID_SUFFIX: AtomicU64 = AtomicU64::new(1);
const WORKBENCH_STATE_RECENT_EVENT_LIMIT: usize = 100;
const PLACEHOLDER_WIDGET_LAYOUT_MODE: &str = "docked";
const PLACEHOLDER_WIDGET_DOCK_X: i64 = 0;
const PLACEHOLDER_WIDGET_DOCK_WIDTH: i64 = 360;
const PLACEHOLDER_WIDGET_DOCK_HEIGHT: i64 = 240;
const PLACEHOLDER_WIDGET_DOCK_GAP: i64 = 16;
const PLACEHOLDER_WIDGET_CONFIG: &str = "{}";
const PLACEHOLDER_WIDGET_STATE: &str = "{}";
const WIDGET_LAYOUT_MODE_DOCKED: &str = "docked";
const WIDGET_LAYOUT_MODE_POPPED_OUT: &str = "popped_out";
const WIDGET_LAYOUT_MODE_MINIMIZED: &str = "minimized";
const MAX_WIDGET_LAYOUT_DIMENSION: i64 = 16_384;
const MAX_WIDGET_LOG_LIMIT: usize = 200;
const WIDGET_LOG_INFO_LEVEL: &str = "info";
const WIDGET_LOG_WIDGET_ADDED: &str = "Widget added";
const WIDGET_LOG_STATE_SAVED: &str = "Widget state saved";
const WIDGET_LOG_LAYOUT_UPDATED: &str = "Widget layout updated";
const WIDGET_RUN_STARTED_STATUS: WidgetRunStatus = WidgetRunStatus::Running;
const GIT_WIDGET_DEFINITION_ID: &str = "git";

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
pub struct WidgetInstanceLayout {
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
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetLogSummary {
    pub id: String,
    pub widget_instance_id: String,
    pub run_id: Option<String>,
    pub level: String,
    pub message: String,
    pub payload: Option<String>,
    pub created_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetRunCommandInput {
    pub command_kind: Option<String>,
    pub command_payload: Option<String>,
    pub summary: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetRunResultInput {
    pub result_type: Option<String>,
    pub summary: Option<String>,
    pub content: Option<String>,
    pub payload: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetRunSummary {
    pub id: String,
    pub widget_instance_id: String,
    pub status: String,
    pub command_kind: Option<String>,
    pub command_payload: Option<String>,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub summary: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetResultSummary {
    pub id: String,
    pub run_id: String,
    pub status: String,
    pub result_type: String,
    pub summary: Option<String>,
    pub content: Option<String>,
    pub payload: Option<String>,
    pub created_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetRunWithResultsSummary {
    pub run: WidgetRunSummary,
    pub results: Vec<WidgetResultSummary>,
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

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GitRepositoryStatusSummary {
    pub branch: Option<GitBranchStatusSummary>,
    pub working_tree: GitWorkingTreeStatusSummary,
    pub changed_files: Vec<GitFileChangeSummary>,
    pub last_commit: Option<GitLastCommitSummary>,
    pub warnings: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GitBranchStatusSummary {
    pub name: Option<String>,
    pub upstream: Option<String>,
    pub ahead: Option<u32>,
    pub behind: Option<u32>,
    pub is_detached: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GitWorkingTreeStatusSummary {
    pub is_clean: bool,
    pub is_dirty: bool,
    pub staged_count: usize,
    pub unstaged_count: usize,
    pub untracked_count: usize,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GitFileChangeSummary {
    pub area: String,
    pub kind: String,
    pub path: String,
    pub original_path: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GitLastCommitSummary {
    pub hash: String,
    pub title: String,
    pub author: Option<String>,
    pub committed_at: Option<String>,
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

        let (workspace, workbench) = self.store.with_immediate_transaction(|store| {
            let workspace =
                store.create_workspace(&workspace_id, title, description.as_deref(), "active")?;
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
        let Some(workspace) = self.store.get_workspace(workspace_id)? else {
            return Ok(None);
        };

        let workbench_id = self.first_workbench_id(&workspace.id)?;
        Ok(Some(workspace_summary(&workspace, workbench_id)))
    }

    pub fn list_workspaces(&self) -> Result<Vec<WorkspaceSummary>, WorkspaceServiceError> {
        Ok(self
            .store
            .list_workspace_summaries_with_workbench()?
            .into_iter()
            .map(workspace_summary_row)
            .collect())
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

        Ok(Some(workspace_workbench_state_from_store(
            &self.store,
            workspace,
            workbench,
        )?))
    }

    pub fn add_widget_instance_to_workbench(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        definition_id: &str,
        title: &str,
        category: &str,
    ) -> Result<Option<WorkspaceWorkbenchState>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let workbench_id = required_input(workbench_id, "workbench id")?;
        let definition_id = required_input(definition_id, "widget definition id")?;
        let title = required_input(title, "widget title")?;
        let category = required_input(category, "widget category")?;

        self.store
            .with_immediate_transaction(|store| {
                let Some(workspace) = store.get_workspace(workspace_id)? else {
                    return Ok(None);
                };

                let Some(workbench) = store
                    .list_workspace_workbenches(&workspace.id)?
                    .into_iter()
                    .find(|workbench| workbench.id == workbench_id)
                else {
                    return Ok(None);
                };

                let existing_widget_count = store
                    .list_widget_instances_for_workbench(&workbench.id)?
                    .len();
                let widget_id = placeholder_id("wid_");
                let widget = store.insert_widget_instance(NewWidgetInstance {
                    id: &widget_id,
                    workspace_id: &workspace.id,
                    workbench_id: &workbench.id,
                    definition_id,
                    title,
                    category,
                    layout_mode: PLACEHOLDER_WIDGET_LAYOUT_MODE,
                    dock_x: Some(PLACEHOLDER_WIDGET_DOCK_X),
                    dock_y: Some(next_placeholder_widget_dock_y(existing_widget_count)),
                    dock_width: Some(PLACEHOLDER_WIDGET_DOCK_WIDTH),
                    dock_height: Some(PLACEHOLDER_WIDGET_DOCK_HEIGHT),
                    popout_x: None,
                    popout_y: None,
                    popout_width: None,
                    popout_height: None,
                    always_on_top: false,
                    is_visible: true,
                    config: Some(PLACEHOLDER_WIDGET_CONFIG),
                    state: Some(PLACEHOLDER_WIDGET_STATE),
                })?;

                append_widget_info_log(store, &widget.id, WIDGET_LOG_WIDGET_ADDED)?;

                let event_payload = format!(
                    "workbench_id={};widget_instance_id={};definition_id={}",
                    workbench.id, widget.id, widget.definition_id
                );
                store.append_workbench_event(
                    &placeholder_id("evt_"),
                    &workspace.id,
                    "widget_instance_added",
                    "Widget instance added",
                    Some(&event_payload),
                )?;
                store.touch_workspace(&workspace.id)?;

                let state =
                    workspace_workbench_state_from_store(store, workspace, Some(workbench))?;
                Ok(Some(state))
            })
            .map_err(WorkspaceServiceError::from)
    }

    pub fn update_widget_instance_state(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        widget_instance_id: &str,
        state: &str,
    ) -> Result<Option<WorkspaceWorkbenchState>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let workbench_id = required_input(workbench_id, "workbench id")?;
        let widget_instance_id = required_input(widget_instance_id, "widget instance id")?;
        validate_json_state(state)?;

        self.store
            .with_immediate_transaction(|store| {
                let Some(workspace) = store.get_workspace(workspace_id)? else {
                    return Ok(None);
                };

                let Some(workbench) = store
                    .list_workspace_workbenches(&workspace.id)?
                    .into_iter()
                    .find(|workbench| workbench.id == workbench_id)
                else {
                    return Ok(None);
                };

                let Some(widget) = store.get_widget_instance(widget_instance_id)? else {
                    return Ok(None);
                };

                if widget.workspace_id != workspace.id || widget.workbench_id != workbench.id {
                    return Ok(None);
                }

                store.update_widget_instance_state(&widget.id, state)?;

                append_widget_info_log(store, &widget.id, WIDGET_LOG_STATE_SAVED)?;

                let event_payload = format!(
                    "workbench_id={};widget_instance_id={}",
                    workbench.id, widget.id
                );
                store.append_workbench_event(
                    &placeholder_id("evt_"),
                    &workspace.id,
                    "widget_state_updated",
                    "Widget state updated",
                    Some(&event_payload),
                )?;
                store.touch_workspace(&workspace.id)?;

                let state =
                    workspace_workbench_state_from_store(store, workspace, Some(workbench))?;
                Ok(Some(state))
            })
            .map_err(WorkspaceServiceError::from)
    }

    pub fn update_widget_instance_layout(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        widget_instance_id: &str,
        layout: WidgetInstanceLayout,
    ) -> Result<Option<WorkspaceWorkbenchState>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let workbench_id = required_input(workbench_id, "workbench id")?;
        let widget_instance_id = required_input(widget_instance_id, "widget instance id")?;
        let layout = validate_widget_instance_layout(layout)?;

        self.store
            .with_immediate_transaction(|store| {
                let Some(workspace) = store.get_workspace(workspace_id)? else {
                    return Ok(None);
                };

                let Some(workbench) = store
                    .list_workspace_workbenches(&workspace.id)?
                    .into_iter()
                    .find(|workbench| workbench.id == workbench_id)
                else {
                    return Ok(None);
                };

                let Some(widget) = store.get_widget_instance(widget_instance_id)? else {
                    return Ok(None);
                };

                if widget.workspace_id != workspace.id || widget.workbench_id != workbench.id {
                    return Ok(None);
                }

                store.update_widget_instance_layout(
                    &widget.id,
                    WidgetInstanceLayoutUpdate {
                        layout_mode: &layout.layout_mode,
                        dock_x: layout.dock_x,
                        dock_y: layout.dock_y,
                        dock_width: layout.dock_width,
                        dock_height: layout.dock_height,
                        popout_x: layout.popout_x,
                        popout_y: layout.popout_y,
                        popout_width: layout.popout_width,
                        popout_height: layout.popout_height,
                        always_on_top: layout.always_on_top,
                        is_visible: layout.is_visible,
                    },
                )?;

                append_widget_info_log(store, &widget.id, WIDGET_LOG_LAYOUT_UPDATED)?;

                let event_payload = format!(
                    "workbench_id={};widget_instance_id={};layout_mode={}",
                    workbench.id, widget.id, layout.layout_mode
                );
                store.append_workbench_event(
                    &placeholder_id("evt_"),
                    &workspace.id,
                    "widget_layout_updated",
                    "Widget layout updated",
                    Some(&event_payload),
                )?;
                store.touch_workspace(&workspace.id)?;

                let state =
                    workspace_workbench_state_from_store(store, workspace, Some(workbench))?;
                Ok(Some(state))
            })
            .map_err(WorkspaceServiceError::from)
    }

    pub fn list_widget_logs(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        widget_instance_id: &str,
        limit: usize,
    ) -> Result<Option<Vec<WidgetLogSummary>>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let workbench_id = required_input(workbench_id, "workbench id")?;
        let widget_instance_id = required_input(widget_instance_id, "widget instance id")?;
        let limit = clamp_widget_log_limit(limit);

        let Some(workspace) = self.store.get_workspace(workspace_id)? else {
            return Ok(None);
        };

        let Some(workbench) = self
            .store
            .list_workspace_workbenches(&workspace.id)?
            .into_iter()
            .find(|workbench| workbench.id == workbench_id)
        else {
            return Ok(None);
        };

        let Some(widget) = self.store.get_widget_instance(widget_instance_id)? else {
            return Ok(None);
        };

        if widget.workspace_id != workspace.id || widget.workbench_id != workbench.id {
            return Ok(None);
        }

        Ok(Some(
            self.store
                .list_widget_logs_for_widget(&widget.id, limit)?
                .into_iter()
                .map(widget_log_summary)
                .collect(),
        ))
    }

    pub fn create_widget_run(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        widget_instance_id: &str,
        command: WidgetRunCommandInput,
    ) -> Result<Option<WidgetRunSummary>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let workbench_id = required_input(workbench_id, "workbench id")?;
        let widget_instance_id = required_input(widget_instance_id, "widget instance id")?;
        let command_kind = optional_trimmed(command.command_kind);
        let command_payload = optional_trimmed(command.command_payload);
        let summary = optional_trimmed(command.summary);

        self.store
            .with_immediate_transaction(|store| {
                let Some((workspace, _workbench, widget)) = validate_widget_ownership(
                    store,
                    workspace_id,
                    workbench_id,
                    widget_instance_id,
                )?
                else {
                    return Ok(None);
                };

                let run_id = placeholder_id("wrun_");
                let run = store.insert_widget_run(NewWidgetRun {
                    id: &run_id,
                    widget_instance_id: &widget.id,
                    status: widget_run_status_value(&WIDGET_RUN_STARTED_STATUS),
                    command_kind: command_kind.as_deref(),
                    command_payload: command_payload.as_deref(),
                    started_at: None,
                    finished_at: None,
                    summary: summary.as_deref(),
                })?;
                store.touch_workspace(&workspace.id)?;

                Ok(Some(widget_run_summary(run)))
            })
            .map_err(WorkspaceServiceError::from)
    }

    pub fn append_widget_run_log(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        widget_instance_id: &str,
        run_id: &str,
        level: &str,
        message: &str,
        details: Option<String>,
    ) -> Result<Option<WidgetLogSummary>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let workbench_id = required_input(workbench_id, "workbench id")?;
        let widget_instance_id = required_input(widget_instance_id, "widget instance id")?;
        let run_id = required_input(run_id, "widget run id")?;
        let level = required_input(level, "widget log level")?;
        let message = required_input(message, "widget log message")?;
        let details = optional_trimmed(details);

        self.store
            .with_immediate_transaction(|store| {
                let Some((workspace, _workbench, widget, run)) = validate_widget_run_ownership(
                    store,
                    workspace_id,
                    workbench_id,
                    widget_instance_id,
                    run_id,
                )?
                else {
                    return Ok(None);
                };

                let log_id = placeholder_id("wlog_");
                let log = store.append_widget_log(NewWidgetLog {
                    id: &log_id,
                    widget_instance_id: &widget.id,
                    run_id: Some(&run.id),
                    level,
                    message,
                    created_at: None,
                    details: details.as_deref(),
                })?;
                store.touch_workspace(&workspace.id)?;

                Ok(Some(widget_log_summary(log)))
            })
            .map_err(WorkspaceServiceError::from)
    }

    pub fn finish_widget_run(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        widget_instance_id: &str,
        run_id: &str,
        final_status: WidgetRunStatus,
        summary: Option<String>,
        result: Option<WidgetRunResultInput>,
    ) -> Result<Option<WidgetRunWithResultsSummary>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let workbench_id = required_input(workbench_id, "workbench id")?;
        let widget_instance_id = required_input(widget_instance_id, "widget instance id")?;
        let run_id = required_input(run_id, "widget run id")?;
        validate_final_widget_run_status(&final_status)?;
        let final_status = widget_run_status_value(&final_status);
        let summary = optional_trimmed(summary);
        let result = result.map(trim_widget_run_result_input);

        self.store
            .with_immediate_transaction(|store| {
                let Some((workspace, _workbench, _widget, run)) = validate_widget_run_ownership(
                    store,
                    workspace_id,
                    workbench_id,
                    widget_instance_id,
                    run_id,
                )?
                else {
                    return Ok(None);
                };

                let run = store.finish_widget_run(
                    &run.id,
                    WidgetRunFinishUpdate {
                        status: final_status,
                        finished_at: None,
                        summary: summary.as_deref(),
                    },
                )?;

                if let Some(result) = result {
                    let result_id = placeholder_id("wres_");
                    store.insert_widget_result(NewWidgetResult {
                        id: &result_id,
                        run_id: &run.id,
                        status: final_status,
                        result_type: result.result_type.as_deref(),
                        summary: result.summary.as_deref(),
                        content: result.content.as_deref(),
                        payload: result.payload.as_deref(),
                        created_at: None,
                    })?;
                }

                let results = store
                    .list_widget_results(&run.id)?
                    .into_iter()
                    .map(widget_result_summary)
                    .collect();
                store.touch_workspace(&workspace.id)?;

                Ok(Some(WidgetRunWithResultsSummary {
                    run: widget_run_summary(run),
                    results,
                }))
            })
            .map_err(WorkspaceServiceError::from)
    }

    pub fn get_widget_run(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        widget_instance_id: &str,
        run_id: &str,
    ) -> Result<Option<WidgetRunWithResultsSummary>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let workbench_id = required_input(workbench_id, "workbench id")?;
        let widget_instance_id = required_input(widget_instance_id, "widget instance id")?;
        let run_id = required_input(run_id, "widget run id")?;

        let Some((_workspace, _workbench, _widget, run)) = validate_widget_run_ownership(
            &self.store,
            workspace_id,
            workbench_id,
            widget_instance_id,
            run_id,
        )?
        else {
            return Ok(None);
        };

        let results = self
            .store
            .list_widget_results(&run.id)?
            .into_iter()
            .map(widget_result_summary)
            .collect();

        Ok(Some(WidgetRunWithResultsSummary {
            run: widget_run_summary(run),
            results,
        }))
    }

    pub fn get_git_repository_status(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        widget_instance_id: &str,
        repository_root: &str,
    ) -> Result<Option<GitRepositoryStatusSummary>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let workbench_id = required_input(workbench_id, "workbench id")?;
        let widget_instance_id = required_input(widget_instance_id, "widget instance id")?;
        let repository_root = required_input(repository_root, "repository root")?;

        self.get_git_repository_status_with_reader(
            workspace_id,
            workbench_id,
            widget_instance_id,
            repository_root,
            read_git_repository_status,
        )
    }

    fn get_git_repository_status_with_reader<F>(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        widget_instance_id: &str,
        repository_root: &str,
        read_status: F,
    ) -> Result<Option<GitRepositoryStatusSummary>, WorkspaceServiceError>
    where
        F: FnOnce(PathBuf) -> Result<ToolsGitRepositoryStatus, GitStatusError>,
    {
        let Some(workspace) = self.store.get_workspace(workspace_id)? else {
            return Ok(None);
        };

        let Some(workbench) = self
            .store
            .list_workspace_workbenches(&workspace.id)?
            .into_iter()
            .find(|workbench| workbench.id == workbench_id)
        else {
            return Ok(None);
        };

        let Some(widget) = self.store.get_widget_instance(widget_instance_id)? else {
            return Ok(None);
        };

        if widget.workspace_id != workspace.id
            || widget.workbench_id != workbench.id
            || widget.definition_id != GIT_WIDGET_DEFINITION_ID
        {
            return Ok(None);
        }

        let status = read_status(Path::new(repository_root).to_path_buf())?;

        Ok(Some(GitRepositoryStatusSummary::from(status)))
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

fn workspace_workbench_state_from_store(
    store: &SqliteStore,
    workspace: WorkspaceRow,
    workbench: Option<WorkspaceWorkbenchRow>,
) -> Result<WorkspaceWorkbenchState, StorageError> {
    let workbench_id = workbench.as_ref().map(|workbench| workbench.id.clone());
    let widget_instances = match workbench.as_ref() {
        Some(workbench) => store
            .list_widget_instances_for_workbench(&workbench.id)?
            .into_iter()
            .map(widget_instance_summary)
            .collect(),
        None => Vec::new(),
    };
    let shared_state_objects = store
        .list_shared_state_objects(&workspace.id)?
        .into_iter()
        .map(shared_state_object_summary)
        .collect();
    let recent_events = match workbench.as_ref() {
        Some(_) => store
            .list_recent_workspace_events(&workspace.id, WORKBENCH_STATE_RECENT_EVENT_LIMIT)?
            .into_iter()
            .map(workbench_event_summary)
            .collect(),
        None => Vec::new(),
    };

    Ok(WorkspaceWorkbenchState {
        workspace: workspace_summary(&workspace, workbench_id),
        workbench: workbench.map(workbench_summary),
        widget_instances,
        shared_state_objects,
        recent_events,
    })
}

fn required_input<'a>(value: &'a str, label: &str) -> Result<&'a str, WorkspaceServiceError> {
    let value = value.trim();
    if value.is_empty() {
        return Err(WorkspaceServiceError::InvalidInput(format!(
            "{label} must not be empty"
        )));
    }

    Ok(value)
}

fn validate_json_state(state: &str) -> Result<(), WorkspaceServiceError> {
    serde_json::from_str::<serde_json::Value>(state).map_err(|error| {
        WorkspaceServiceError::InvalidInput(format!("widget state must be valid JSON: {error}"))
    })?;
    Ok(())
}

fn validate_widget_instance_layout(
    mut layout: WidgetInstanceLayout,
) -> Result<WidgetInstanceLayout, WorkspaceServiceError> {
    let layout_mode = required_input(&layout.layout_mode, "widget layout mode")?.to_owned();
    match layout_mode.as_str() {
        WIDGET_LAYOUT_MODE_DOCKED
        | WIDGET_LAYOUT_MODE_POPPED_OUT
        | WIDGET_LAYOUT_MODE_MINIMIZED => {}
        _ => {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "unsupported widget layout mode: {layout_mode}"
            )));
        }
    }
    layout.layout_mode = layout_mode;

    validate_dimension("dock_width", layout.dock_width)?;
    validate_dimension("dock_height", layout.dock_height)?;
    validate_dimension("popout_width", layout.popout_width)?;
    validate_dimension("popout_height", layout.popout_height)?;

    if layout.dock_width.is_none() || layout.dock_height.is_none() {
        return Err(WorkspaceServiceError::InvalidInput(
            "dock dimensions are required".to_owned(),
        ));
    }

    if layout.layout_mode == WIDGET_LAYOUT_MODE_POPPED_OUT
        && (layout.popout_width.is_none() || layout.popout_height.is_none())
    {
        return Err(WorkspaceServiceError::InvalidInput(
            "popout dimensions are required for popped_out layout".to_owned(),
        ));
    }

    if layout.always_on_top && layout.layout_mode != WIDGET_LAYOUT_MODE_POPPED_OUT {
        return Err(WorkspaceServiceError::InvalidInput(
            "always_on_top is only valid for popped_out layout".to_owned(),
        ));
    }

    Ok(layout)
}

fn validate_dimension(label: &str, dimension: Option<i64>) -> Result<(), WorkspaceServiceError> {
    let Some(dimension) = dimension else {
        return Ok(());
    };

    if dimension <= 0 {
        return Err(WorkspaceServiceError::InvalidInput(format!(
            "{label} must be positive"
        )));
    }

    if dimension > MAX_WIDGET_LAYOUT_DIMENSION {
        return Err(WorkspaceServiceError::InvalidInput(format!(
            "{label} must be no greater than {MAX_WIDGET_LAYOUT_DIMENSION}"
        )));
    }

    Ok(())
}

fn clamp_widget_log_limit(limit: usize) -> usize {
    limit.min(MAX_WIDGET_LOG_LIMIT)
}

fn validate_widget_ownership(
    store: &SqliteStore,
    workspace_id: &str,
    workbench_id: &str,
    widget_instance_id: &str,
) -> Result<Option<(WorkspaceRow, WorkspaceWorkbenchRow, WidgetInstanceRow)>, StorageError> {
    let Some(workspace) = store.get_workspace(workspace_id)? else {
        return Ok(None);
    };

    let Some(workbench) = store
        .list_workspace_workbenches(&workspace.id)?
        .into_iter()
        .find(|workbench| workbench.id == workbench_id)
    else {
        return Ok(None);
    };

    let Some(widget) = store.get_widget_instance(widget_instance_id)? else {
        return Ok(None);
    };

    if widget.workspace_id != workspace.id || widget.workbench_id != workbench.id {
        return Ok(None);
    }

    Ok(Some((workspace, workbench, widget)))
}

fn validate_widget_run_ownership(
    store: &SqliteStore,
    workspace_id: &str,
    workbench_id: &str,
    widget_instance_id: &str,
    run_id: &str,
) -> Result<
    Option<(
        WorkspaceRow,
        WorkspaceWorkbenchRow,
        WidgetInstanceRow,
        WidgetRunRow,
    )>,
    StorageError,
> {
    let Some((workspace, workbench, widget)) =
        validate_widget_ownership(store, workspace_id, workbench_id, widget_instance_id)?
    else {
        return Ok(None);
    };

    let Some(run) = store.get_widget_run(run_id)? else {
        return Ok(None);
    };

    if run.widget_instance_id != widget.id {
        return Ok(None);
    }

    Ok(Some((workspace, workbench, widget, run)))
}

fn optional_trimmed(value: Option<String>) -> Option<String> {
    value
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

fn trim_widget_run_result_input(mut input: WidgetRunResultInput) -> WidgetRunResultInput {
    input.result_type = optional_trimmed(input.result_type);
    input.summary = optional_trimmed(input.summary);
    input.content = optional_trimmed(input.content);
    input.payload = optional_trimmed(input.payload);
    input
}

fn validate_final_widget_run_status(status: &WidgetRunStatus) -> Result<(), WorkspaceServiceError> {
    match status {
        WidgetRunStatus::Completed
        | WidgetRunStatus::Failed
        | WidgetRunStatus::TimedOut
        | WidgetRunStatus::Cancelled => Ok(()),
        _ => Err(WorkspaceServiceError::InvalidInput(format!(
            "unsupported final widget run status: {}",
            widget_run_status_value(status)
        ))),
    }
}

fn widget_run_status_value(status: &WidgetRunStatus) -> &'static str {
    match status {
        WidgetRunStatus::Idle => "idle",
        WidgetRunStatus::InputReady => "input_ready",
        WidgetRunStatus::WaitingForApproval => "waiting_for_approval",
        WidgetRunStatus::Running => "running",
        WidgetRunStatus::ResultReady => "result_ready",
        WidgetRunStatus::Completed => "completed",
        WidgetRunStatus::Failed => "failed",
        WidgetRunStatus::TimedOut => "timed_out",
        WidgetRunStatus::Cancelled => "cancelled",
    }
}

fn append_widget_info_log(
    store: &SqliteStore,
    widget_instance_id: &str,
    message: &str,
) -> Result<(), StorageError> {
    let log_id = placeholder_id("wlog_");
    store.append_widget_log(NewWidgetLog {
        id: &log_id,
        widget_instance_id,
        run_id: None,
        level: WIDGET_LOG_INFO_LEVEL,
        message,
        created_at: None,
        details: None,
    })?;
    Ok(())
}

fn next_placeholder_widget_dock_y(existing_widget_count: usize) -> i64 {
    existing_widget_count as i64 * (PLACEHOLDER_WIDGET_DOCK_HEIGHT + PLACEHOLDER_WIDGET_DOCK_GAP)
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

fn workspace_summary_row(row: WorkspaceSummaryRow) -> WorkspaceSummary {
    WorkspaceSummary {
        id: row.id,
        title: row.title,
        description: row.description,
        status: row.status,
        workbench_id: row.workbench_id,
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

fn widget_log_summary(row: WidgetLogRow) -> WidgetLogSummary {
    WidgetLogSummary {
        id: row.id,
        widget_instance_id: row.widget_instance_id,
        run_id: row.run_id,
        level: row.level,
        message: row.message,
        payload: row.details,
        created_at: row.created_at,
    }
}

fn widget_run_summary(row: WidgetRunRow) -> WidgetRunSummary {
    WidgetRunSummary {
        id: row.id,
        widget_instance_id: row.widget_instance_id,
        status: row.status,
        command_kind: row.command_kind,
        command_payload: row.command_payload,
        started_at: row.started_at,
        finished_at: row.finished_at,
        summary: row.summary,
    }
}

fn widget_result_summary(row: WidgetResultRow) -> WidgetResultSummary {
    WidgetResultSummary {
        id: row.id,
        run_id: row.run_id,
        status: row.status,
        result_type: row.result_type,
        summary: row.summary,
        content: row.content,
        payload: row.payload,
        created_at: row.created_at,
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

impl From<ToolsGitRepositoryStatus> for GitRepositoryStatusSummary {
    fn from(status: ToolsGitRepositoryStatus) -> Self {
        Self {
            branch: status.branch.map(GitBranchStatusSummary::from),
            working_tree: GitWorkingTreeStatusSummary::from(status.working_tree),
            changed_files: status
                .changed_files
                .into_iter()
                .map(GitFileChangeSummary::from)
                .collect(),
            last_commit: status.last_commit.map(GitLastCommitSummary::from),
            warnings: status.warnings,
        }
    }
}

impl From<ToolsGitBranchSummary> for GitBranchStatusSummary {
    fn from(summary: ToolsGitBranchSummary) -> Self {
        Self {
            name: summary.name,
            upstream: summary.upstream,
            ahead: summary.ahead,
            behind: summary.behind,
            is_detached: summary.is_detached,
        }
    }
}

impl From<ToolsGitWorkingTreeSummary> for GitWorkingTreeStatusSummary {
    fn from(summary: ToolsGitWorkingTreeSummary) -> Self {
        Self {
            is_clean: summary.is_clean,
            is_dirty: !summary.is_clean,
            staged_count: summary.staged_count,
            unstaged_count: summary.unstaged_count,
            untracked_count: summary.untracked_count,
        }
    }
}

impl From<ToolsGitFileChange> for GitFileChangeSummary {
    fn from(change: ToolsGitFileChange) -> Self {
        Self {
            area: git_file_change_area(change.area).to_owned(),
            kind: git_file_change_kind(change.kind).to_owned(),
            path: change.path,
            original_path: change.original_path,
        }
    }
}

impl From<ToolsGitLastCommitSummary> for GitLastCommitSummary {
    fn from(summary: ToolsGitLastCommitSummary) -> Self {
        Self {
            hash: summary.hash,
            title: summary.title,
            author: summary.author,
            committed_at: summary.committed_at,
        }
    }
}

fn git_file_change_area(area: GitFileChangeArea) -> &'static str {
    match area {
        GitFileChangeArea::Staged => "staged",
        GitFileChangeArea::Unstaged => "unstaged",
        GitFileChangeArea::Untracked => "untracked",
    }
}

fn git_file_change_kind(kind: GitFileChangeKind) -> &'static str {
    match kind {
        GitFileChangeKind::Added => "added",
        GitFileChangeKind::Modified => "modified",
        GitFileChangeKind::Deleted => "deleted",
        GitFileChangeKind::Renamed => "renamed",
        GitFileChangeKind::Copied => "copied",
        GitFileChangeKind::Untracked => "untracked",
        GitFileChangeKind::Conflicted => "conflicted",
        GitFileChangeKind::Unknown => "unknown",
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
    use std::cell::RefCell;

    use hobit_storage_sqlite::{NewSharedStateObject, NewWidgetInstance, NewWidgetLog};

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
    fn list_workspaces_returns_recent_workspaces_with_first_workbench_ids() {
        let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
        store.init_schema().expect("initialize schema");
        store
            .create_workspace("workspace-z-older", "Older", None, "active")
            .expect("create older workspace");
        store
            .create_workspace_workbench("workbench-a-first", "workspace-z-older", None)
            .expect("create first workbench");
        store
            .create_workspace_workbench("workbench-z-later", "workspace-z-older", None)
            .expect("create later workbench");
        store
            .create_workspace("workspace-a-newer", "Newer", None, "active")
            .expect("create newer workspace");
        store
            .create_workspace_workbench("workbench-newer", "workspace-a-newer", None)
            .expect("create newer workbench");
        let service = WorkspaceService::new(store);

        let workspaces = service.list_workspaces().expect("list workspaces");

        assert_eq!(
            workspace_ids(&workspaces),
            vec!["workspace-a-newer", "workspace-z-older"]
        );
        assert_eq!(
            workspace_workbench_ids(&workspaces),
            vec![Some("workbench-newer"), Some("workbench-a-first")]
        );
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
    fn get_workbench_state_includes_shared_state_and_recent_workspace_events() {
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

    #[test]
    fn add_widget_instance_to_workbench_persists_widget_and_returns_updated_state() {
        let service = initialized_service();
        let workspace = service
            .create_empty_workspace("Incident", None)
            .expect("create workspace");
        let workbench_id = workspace
            .workbench_id
            .as_deref()
            .expect("created workbench id");

        let state = service
            .add_widget_instance_to_workbench(
                &workspace.id,
                workbench_id,
                "notes",
                "Notes",
                "notes",
            )
            .expect("add widget instance")
            .expect("updated workbench state");
        let stored_widgets = service
            .store
            .list_widget_instances_for_workbench(workbench_id)
            .expect("list stored widgets");
        let widget_id = stored_widgets[0].id.clone();
        let logs = service
            .list_widget_logs(&workspace.id, workbench_id, &widget_id, 10)
            .expect("list widget logs")
            .expect("widget logs");

        assert_eq!(stored_widgets.len(), 1);
        assert_eq!(
            state.widget_instances,
            vec![WidgetInstanceSummary {
                id: widget_id.clone(),
                definition_id: "notes".to_owned(),
                title: "Notes".to_owned(),
                category: "notes".to_owned(),
                layout_mode: "docked".to_owned(),
                dock_x: Some(0),
                dock_y: Some(0),
                dock_width: Some(360),
                dock_height: Some(240),
                popout_x: None,
                popout_y: None,
                popout_width: None,
                popout_height: None,
                always_on_top: false,
                is_visible: true,
                config: Some("{}".to_owned()),
                state: Some("{}".to_owned()),
            }]
        );
        assert!(stored_widgets[0].id.starts_with("wid_"));
        assert_eq!(widget_log_messages(&logs), vec![WIDGET_LOG_WIDGET_ADDED]);
        assert_eq!(logs[0].widget_instance_id, widget_id);
        assert_eq!(logs[0].level, WIDGET_LOG_INFO_LEVEL);
        assert_eq!(logs[0].run_id, None);
        assert_eq!(logs[0].payload, None);
        assert!(state
            .recent_events
            .iter()
            .any(|event| event.kind == "widget_instance_added"));
    }

    #[test]
    fn add_widget_instance_to_unowned_workbench_returns_none() {
        let service = initialized_service();
        let workspace = service
            .create_empty_workspace("Incident", None)
            .expect("create workspace");
        let other_workspace = service
            .create_empty_workspace("Other Incident", None)
            .expect("create other workspace");
        let other_workbench_id = other_workspace
            .workbench_id
            .as_deref()
            .expect("other workbench id");

        let state = service
            .add_widget_instance_to_workbench(
                &workspace.id,
                other_workbench_id,
                "notes",
                "Notes",
                "notes",
            )
            .expect("add widget instance");
        let other_widgets = service
            .store
            .list_widget_instances_for_workbench(other_workbench_id)
            .expect("list other workbench widgets");

        assert!(state.is_none());
        assert!(other_widgets.is_empty());
    }

    #[test]
    fn add_widget_instance_rejects_empty_definition_id() {
        let service = initialized_service();
        let workspace = service
            .create_empty_workspace("Incident", None)
            .expect("create workspace");
        let workbench_id = workspace
            .workbench_id
            .as_deref()
            .expect("created workbench id");

        let error = service
            .add_widget_instance_to_workbench(&workspace.id, workbench_id, "  ", "Notes", "notes")
            .expect_err("reject empty definition id");

        assert!(matches!(error, WorkspaceServiceError::InvalidInput(_)));
    }

    #[test]
    fn update_widget_instance_state_persists_state_and_returns_updated_state() {
        let service = initialized_service();
        let workspace = service
            .create_empty_workspace("Incident", None)
            .expect("create workspace");
        let workbench_id = workspace
            .workbench_id
            .as_deref()
            .expect("created workbench id");
        let state_after_add = service
            .add_widget_instance_to_workbench(
                &workspace.id,
                workbench_id,
                "notes",
                "Notes",
                "notes",
            )
            .expect("add widget instance")
            .expect("state after add");
        let widget_id = state_after_add.widget_instances[0].id.clone();

        let updated_state = service
            .update_widget_instance_state(
                &workspace.id,
                workbench_id,
                &widget_id,
                "{\"body\":\"Draft\"}",
            )
            .expect("update widget state")
            .expect("updated workbench state");
        let stored_widget = service
            .store
            .get_widget_instance(&widget_id)
            .expect("get stored widget")
            .expect("stored widget");

        assert_eq!(stored_widget.state.as_deref(), Some("{\"body\":\"Draft\"}"));
        assert_eq!(
            updated_state.widget_instances[0].state.as_deref(),
            Some("{\"body\":\"Draft\"}")
        );
        let logs = service
            .list_widget_logs(&workspace.id, workbench_id, &widget_id, 10)
            .expect("list widget logs")
            .expect("widget logs");
        let messages = widget_log_messages(&logs);

        assert_eq!(logs.len(), 2);
        assert!(messages.contains(&WIDGET_LOG_WIDGET_ADDED));
        assert!(messages.contains(&WIDGET_LOG_STATE_SAVED));
        assert!(updated_state
            .recent_events
            .iter()
            .any(|event| event.kind == "widget_state_updated"));
    }

    #[test]
    fn update_widget_instance_state_for_other_workbench_returns_none_without_mutation() {
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
            .create_workspace_workbench("other-workbench", &workspace.id, None)
            .expect("create other workbench");
        service
            .store
            .insert_widget_instance(NewWidgetInstance {
                id: "other-widget",
                workspace_id: &workspace.id,
                workbench_id: "other-workbench",
                definition_id: "notes",
                title: "Other Notes",
                category: "notes",
                layout_mode: "docked",
                dock_x: Some(0),
                dock_y: Some(0),
                dock_width: Some(360),
                dock_height: Some(240),
                popout_x: None,
                popout_y: None,
                popout_width: None,
                popout_height: None,
                always_on_top: false,
                is_visible: true,
                config: Some("{}"),
                state: Some("{\"body\":\"Original\"}"),
            })
            .expect("insert other workbench widget");

        let state = service
            .update_widget_instance_state(
                &workspace.id,
                workbench_id,
                "other-widget",
                "{\"body\":\"Changed\"}",
            )
            .expect("update widget state");
        let stored_widget = service
            .store
            .get_widget_instance("other-widget")
            .expect("get stored widget")
            .expect("stored widget");
        let logs = service
            .list_widget_logs(&workspace.id, "other-workbench", "other-widget", 10)
            .expect("list widget logs")
            .expect("widget logs");

        assert!(state.is_none());
        assert_eq!(
            stored_widget.state.as_deref(),
            Some("{\"body\":\"Original\"}")
        );
        assert!(logs.is_empty());
    }

    #[test]
    fn update_widget_instance_state_rejects_invalid_json_state() {
        let service = initialized_service();
        let workspace = service
            .create_empty_workspace("Incident", None)
            .expect("create workspace");
        let workbench_id = workspace
            .workbench_id
            .as_deref()
            .expect("created workbench id");

        let error = service
            .update_widget_instance_state(&workspace.id, workbench_id, "widget-1", "{bad")
            .expect_err("reject invalid JSON");

        assert!(matches!(error, WorkspaceServiceError::InvalidInput(_)));
    }

    #[test]
    fn update_widget_instance_layout_persists_layout_and_returns_updated_state() {
        let service = initialized_service();
        let workspace = service
            .create_empty_workspace("Incident", None)
            .expect("create workspace");
        let workbench_id = workspace
            .workbench_id
            .as_deref()
            .expect("created workbench id");
        let state_after_add = service
            .add_widget_instance_to_workbench(
                &workspace.id,
                workbench_id,
                "notes",
                "Notes",
                "notes",
            )
            .expect("add widget instance")
            .expect("state after add");
        let widget_id = state_after_add.widget_instances[0].id.clone();

        let updated_state = service
            .update_widget_instance_layout(
                &workspace.id,
                workbench_id,
                &widget_id,
                popped_out_layout(),
            )
            .expect("update widget layout")
            .expect("updated workbench state");
        let stored_widget = service
            .store
            .get_widget_instance(&widget_id)
            .expect("get stored widget")
            .expect("stored widget");

        assert_eq!(stored_widget.layout_mode, "popped_out");
        assert_eq!(stored_widget.dock_x, Some(12));
        assert_eq!(stored_widget.dock_y, Some(24));
        assert_eq!(stored_widget.dock_width, Some(480));
        assert_eq!(stored_widget.dock_height, Some(320));
        assert_eq!(stored_widget.popout_x, Some(120));
        assert_eq!(stored_widget.popout_y, Some(140));
        assert_eq!(stored_widget.popout_width, Some(720));
        assert_eq!(stored_widget.popout_height, Some(520));
        assert!(stored_widget.always_on_top);
        assert!(stored_widget.is_visible);
        assert_eq!(updated_state.widget_instances[0].layout_mode, "popped_out");
        assert_eq!(updated_state.widget_instances[0].popout_width, Some(720));
        assert!(updated_state.widget_instances[0].always_on_top);
        let logs = service
            .list_widget_logs(&workspace.id, workbench_id, &widget_id, 10)
            .expect("list widget logs")
            .expect("widget logs");
        let messages = widget_log_messages(&logs);

        assert_eq!(logs.len(), 2);
        assert!(messages.contains(&WIDGET_LOG_WIDGET_ADDED));
        assert!(messages.contains(&WIDGET_LOG_LAYOUT_UPDATED));
        assert!(updated_state
            .recent_events
            .iter()
            .any(|event| event.kind == "widget_layout_updated"));
    }

    #[test]
    fn update_widget_instance_layout_for_other_workbench_returns_none_without_mutation() {
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
            .create_workspace_workbench("other-workbench", &workspace.id, None)
            .expect("create other workbench");
        service
            .store
            .insert_widget_instance(NewWidgetInstance {
                id: "other-widget",
                workspace_id: &workspace.id,
                workbench_id: "other-workbench",
                definition_id: "notes",
                title: "Other Notes",
                category: "notes",
                layout_mode: "docked",
                dock_x: Some(0),
                dock_y: Some(0),
                dock_width: Some(360),
                dock_height: Some(240),
                popout_x: None,
                popout_y: None,
                popout_width: None,
                popout_height: None,
                always_on_top: false,
                is_visible: true,
                config: Some("{}"),
                state: Some("{}"),
            })
            .expect("insert other workbench widget");

        let state = service
            .update_widget_instance_layout(
                &workspace.id,
                workbench_id,
                "other-widget",
                popped_out_layout(),
            )
            .expect("update widget layout");
        let stored_widget = service
            .store
            .get_widget_instance("other-widget")
            .expect("get stored widget")
            .expect("stored widget");
        let events = service
            .store
            .list_workbench_events(&workspace.id)
            .expect("list events");
        let logs = service
            .list_widget_logs(&workspace.id, "other-workbench", "other-widget", 10)
            .expect("list widget logs")
            .expect("widget logs");

        assert!(state.is_none());
        assert_eq!(stored_widget.layout_mode, "docked");
        assert_eq!(stored_widget.dock_width, Some(360));
        assert_eq!(stored_widget.popout_width, None);
        assert!(!stored_widget.always_on_top);
        assert!(!events
            .iter()
            .any(|event| event.kind == "widget_layout_updated"));
        assert!(logs.is_empty());
    }

    #[test]
    fn update_widget_instance_layout_rejects_invalid_dimensions() {
        let service = initialized_service();
        let workspace = service
            .create_empty_workspace("Incident", None)
            .expect("create workspace");
        let workbench_id = workspace
            .workbench_id
            .as_deref()
            .expect("created workbench id");
        let state_after_add = service
            .add_widget_instance_to_workbench(
                &workspace.id,
                workbench_id,
                "notes",
                "Notes",
                "notes",
            )
            .expect("add widget instance")
            .expect("state after add");
        let widget_id = state_after_add.widget_instances[0].id.clone();
        let mut invalid_layout = docked_layout();
        invalid_layout.dock_width = Some(0);

        let error = service
            .update_widget_instance_layout(&workspace.id, workbench_id, &widget_id, invalid_layout)
            .expect_err("reject invalid dimensions");
        let stored_widget = service
            .store
            .get_widget_instance(&widget_id)
            .expect("get stored widget")
            .expect("stored widget");

        assert!(matches!(error, WorkspaceServiceError::InvalidInput(_)));
        let mut oversized_layout = docked_layout();
        oversized_layout.dock_height = Some(MAX_WIDGET_LAYOUT_DIMENSION + 1);
        let oversized_error = service
            .update_widget_instance_layout(
                &workspace.id,
                workbench_id,
                &widget_id,
                oversized_layout,
            )
            .expect_err("reject oversized dimensions");

        assert!(matches!(
            oversized_error,
            WorkspaceServiceError::InvalidInput(_)
        ));
        assert_eq!(stored_widget.layout_mode, "docked");
        assert_eq!(stored_widget.dock_width, Some(360));
        assert_eq!(stored_widget.dock_height, Some(240));
        let logs = service
            .list_widget_logs(&workspace.id, workbench_id, &widget_id, 10)
            .expect("list widget logs")
            .expect("widget logs");

        assert_eq!(widget_log_messages(&logs), vec![WIDGET_LOG_WIDGET_ADDED]);
    }

    #[test]
    fn get_git_repository_status_for_valid_widget_reads_status_without_writes() {
        let service = initialized_service();
        let workspace = service
            .create_empty_workspace("Incident", None)
            .expect("create workspace");
        let workbench_id = workspace
            .workbench_id
            .as_deref()
            .expect("created workbench id");
        let state_after_add = service
            .add_widget_instance_to_workbench(&workspace.id, workbench_id, "git", "Git", "git")
            .expect("add Git widget")
            .expect("state after add");
        let widget_id = state_after_add.widget_instances[0].id.clone();
        let event_count = service
            .store
            .list_workbench_events(&workspace.id)
            .expect("list events")
            .len();
        let log_count = service
            .list_widget_logs(&workspace.id, workbench_id, &widget_id, 10)
            .expect("list logs")
            .expect("logs")
            .len();
        let called_path = RefCell::new(None);

        let status = service
            .get_git_repository_status_with_reader(
                &workspace.id,
                workbench_id,
                &widget_id,
                "repo-root",
                |repository_root| {
                    *called_path.borrow_mut() = Some(repository_root);
                    Ok(git_status_fixture())
                },
            )
            .expect("read Git status")
            .expect("Git status");

        let events_after_read = service
            .store
            .list_workbench_events(&workspace.id)
            .expect("list events")
            .len();
        let logs_after_read = service
            .list_widget_logs(&workspace.id, workbench_id, &widget_id, 10)
            .expect("list logs")
            .expect("logs")
            .len();

        assert_eq!(called_path.into_inner(), Some(PathBuf::from("repo-root")));
        assert_eq!(
            status
                .branch
                .as_ref()
                .and_then(|branch| branch.name.as_deref()),
            Some("main")
        );
        assert_eq!(status.working_tree.staged_count, 1);
        assert!(status.working_tree.is_dirty);
        assert_eq!(status.changed_files[0].kind, "modified");
        assert_eq!(events_after_read, event_count);
        assert_eq!(logs_after_read, log_count);
    }

    #[test]
    fn get_git_repository_status_for_other_workbench_returns_none_before_read() {
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
            .create_workspace_workbench("other-workbench", &workspace.id, None)
            .expect("create other workbench");
        service
            .store
            .insert_widget_instance(NewWidgetInstance {
                id: "other-git-widget",
                workspace_id: &workspace.id,
                workbench_id: "other-workbench",
                definition_id: "git",
                title: "Git",
                category: "git",
                layout_mode: "docked",
                dock_x: Some(0),
                dock_y: Some(0),
                dock_width: Some(360),
                dock_height: Some(240),
                popout_x: None,
                popout_y: None,
                popout_width: None,
                popout_height: None,
                always_on_top: false,
                is_visible: true,
                config: Some("{}"),
                state: Some("{}"),
            })
            .expect("insert other workbench Git widget");

        let status = service
            .get_git_repository_status_with_reader(
                &workspace.id,
                workbench_id,
                "other-git-widget",
                "repo-root",
                |_| panic!("Git status reader should not be called"),
            )
            .expect("reject other workbench widget");

        assert!(status.is_none());
    }

    #[test]
    fn get_git_repository_status_for_non_git_widget_returns_none_before_read() {
        let service = initialized_service();
        let workspace = service
            .create_empty_workspace("Incident", None)
            .expect("create workspace");
        let workbench_id = workspace
            .workbench_id
            .as_deref()
            .expect("created workbench id");
        let state_after_add = service
            .add_widget_instance_to_workbench(
                &workspace.id,
                workbench_id,
                "notes",
                "Notes",
                "notes",
            )
            .expect("add Notes widget")
            .expect("state after add");
        let widget_id = state_after_add.widget_instances[0].id.clone();

        let status = service
            .get_git_repository_status_with_reader(
                &workspace.id,
                workbench_id,
                &widget_id,
                "repo-root",
                |_| panic!("Git status reader should not be called"),
            )
            .expect("reject non-Git widget");

        assert!(status.is_none());
    }

    #[test]
    fn get_git_repository_status_rejects_empty_repository_root() {
        let service = initialized_service();
        let workspace = service
            .create_empty_workspace("Incident", None)
            .expect("create workspace");
        let workbench_id = workspace
            .workbench_id
            .as_deref()
            .expect("created workbench id");
        let state_after_add = service
            .add_widget_instance_to_workbench(&workspace.id, workbench_id, "git", "Git", "git")
            .expect("add Git widget")
            .expect("state after add");
        let widget_id = state_after_add.widget_instances[0].id.clone();

        let error = service
            .get_git_repository_status(&workspace.id, workbench_id, &widget_id, "  ")
            .expect_err("reject empty repository root");

        assert!(matches!(error, WorkspaceServiceError::InvalidInput(_)));
    }

    #[test]
    fn list_widget_logs_for_valid_widget_returns_logs() {
        let service = initialized_service();
        let workspace = service
            .create_empty_workspace("Incident", None)
            .expect("create workspace");
        let workbench_id = workspace
            .workbench_id
            .as_deref()
            .expect("created workbench id");
        let state_after_add = service
            .add_widget_instance_to_workbench(
                &workspace.id,
                workbench_id,
                "notes",
                "Notes",
                "notes",
            )
            .expect("add widget instance")
            .expect("state after add");
        let widget_id = state_after_add.widget_instances[0].id.clone();
        service
            .store
            .append_widget_log(NewWidgetLog {
                id: "log-1",
                widget_instance_id: &widget_id,
                run_id: None,
                level: "info",
                message: "Saved note",
                created_at: Some("1"),
                details: Some("{\"source\":\"test\"}"),
            })
            .expect("append widget log");
        let event_count = service
            .store
            .list_workbench_events(&workspace.id)
            .expect("list events")
            .len();

        let logs = service
            .list_widget_logs(&workspace.id, workbench_id, &widget_id, 10)
            .expect("list widget logs")
            .expect("widget logs");
        let events_after_listing = service
            .store
            .list_workbench_events(&workspace.id)
            .expect("list events")
            .len();

        let saved_log = logs
            .iter()
            .find(|log| log.id == "log-1")
            .expect("manual saved log");

        assert_eq!(logs.len(), 2);
        assert!(widget_log_messages(&logs).contains(&WIDGET_LOG_WIDGET_ADDED));
        assert_eq!(saved_log.widget_instance_id, widget_id);
        assert_eq!(saved_log.run_id, None);
        assert_eq!(saved_log.level, "info");
        assert_eq!(saved_log.message, "Saved note");
        assert_eq!(saved_log.payload.as_deref(), Some("{\"source\":\"test\"}"));
        assert_eq!(saved_log.created_at, "1");
        assert_eq!(events_after_listing, event_count);
    }

    #[test]
    fn list_widget_logs_for_other_workbench_returns_none_without_leaking_logs() {
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
            .create_workspace_workbench("other-workbench", &workspace.id, None)
            .expect("create other workbench");
        service
            .store
            .insert_widget_instance(NewWidgetInstance {
                id: "other-widget",
                workspace_id: &workspace.id,
                workbench_id: "other-workbench",
                definition_id: "notes",
                title: "Other Notes",
                category: "notes",
                layout_mode: "docked",
                dock_x: Some(0),
                dock_y: Some(0),
                dock_width: Some(360),
                dock_height: Some(240),
                popout_x: None,
                popout_y: None,
                popout_width: None,
                popout_height: None,
                always_on_top: false,
                is_visible: true,
                config: Some("{}"),
                state: Some("{}"),
            })
            .expect("insert other workbench widget");
        service
            .store
            .append_widget_log(NewWidgetLog {
                id: "other-log",
                widget_instance_id: "other-widget",
                run_id: None,
                level: "info",
                message: "Other workbench activity",
                created_at: Some("1"),
                details: None,
            })
            .expect("append other widget log");

        let logs = service
            .list_widget_logs(&workspace.id, workbench_id, "other-widget", 10)
            .expect("list widget logs");

        assert!(logs.is_none());
    }

    #[test]
    fn create_widget_run_for_owned_widget_persists_running_run() {
        let service = initialized_service();
        let workspace = service
            .create_empty_workspace("Incident", None)
            .expect("create workspace");
        let workbench_id = workspace
            .workbench_id
            .as_deref()
            .expect("created workbench id");
        let state_after_add = service
            .add_widget_instance_to_workbench(
                &workspace.id,
                workbench_id,
                "terminal",
                "Terminal",
                "tool",
            )
            .expect("add widget")
            .expect("state after add");
        let widget_id = state_after_add.widget_instances[0].id.clone();

        let run = service
            .create_widget_run(
                &workspace.id,
                workbench_id,
                &widget_id,
                WidgetRunCommandInput {
                    command_kind: Some("preview".to_owned()),
                    command_payload: Some("{\"kind\":\"dry\"}".to_owned()),
                    summary: Some("Preview lifecycle only".to_owned()),
                },
            )
            .expect("create widget run")
            .expect("widget run");
        let stored_runs = service
            .store
            .list_widget_runs_for_widget(&widget_id)
            .expect("list widget runs");

        assert!(run.id.starts_with("wrun_"));
        assert_eq!(run.widget_instance_id, widget_id);
        assert_eq!(run.status, "running");
        assert_eq!(run.command_kind.as_deref(), Some("preview"));
        assert_eq!(run.command_payload.as_deref(), Some("{\"kind\":\"dry\"}"));
        assert_eq!(run.summary.as_deref(), Some("Preview lifecycle only"));
        assert_eq!(run.finished_at, None);
        assert_eq!(stored_runs.len(), 1);
        assert_eq!(stored_runs[0].id, run.id);
    }

    #[test]
    fn widget_run_lifecycle_rejects_unowned_widget_or_run_without_mutation() {
        let service = initialized_service();
        let workspace = service
            .create_empty_workspace("Incident", None)
            .expect("create workspace");
        let workbench_id = workspace
            .workbench_id
            .as_deref()
            .expect("created workbench id");
        let state_after_add = service
            .add_widget_instance_to_workbench(
                &workspace.id,
                workbench_id,
                "terminal",
                "Terminal",
                "tool",
            )
            .expect("add widget")
            .expect("state after add");
        let widget_id = state_after_add.widget_instances[0].id.clone();
        service
            .store
            .create_workspace_workbench("other-workbench", &workspace.id, None)
            .expect("create other workbench");
        service
            .store
            .insert_widget_instance(NewWidgetInstance {
                id: "other-widget",
                workspace_id: &workspace.id,
                workbench_id: "other-workbench",
                definition_id: "terminal",
                title: "Other Terminal",
                category: "tool",
                layout_mode: "docked",
                dock_x: Some(0),
                dock_y: Some(0),
                dock_width: Some(360),
                dock_height: Some(240),
                popout_x: None,
                popout_y: None,
                popout_width: None,
                popout_height: None,
                always_on_top: false,
                is_visible: true,
                config: Some("{}"),
                state: Some("{}"),
            })
            .expect("insert other widget");
        let other_run = service
            .create_widget_run(
                &workspace.id,
                "other-workbench",
                "other-widget",
                WidgetRunCommandInput {
                    command_kind: Some("preview".to_owned()),
                    command_payload: None,
                    summary: None,
                },
            )
            .expect("create other run")
            .expect("other run");

        let invalid_create = service
            .create_widget_run(
                &workspace.id,
                workbench_id,
                "other-widget",
                WidgetRunCommandInput {
                    command_kind: Some("preview".to_owned()),
                    command_payload: None,
                    summary: None,
                },
            )
            .expect("reject create");
        let invalid_log = service
            .append_widget_run_log(
                &workspace.id,
                workbench_id,
                &widget_id,
                &other_run.id,
                "info",
                "Should not leak",
                Some("{\"leak\":true}".to_owned()),
            )
            .expect("reject append log");
        let invalid_finish = service
            .finish_widget_run(
                &workspace.id,
                workbench_id,
                &widget_id,
                &other_run.id,
                WidgetRunStatus::Completed,
                Some("Should not finish".to_owned()),
                Some(WidgetRunResultInput {
                    result_type: Some("test".to_owned()),
                    summary: Some("Leaked result".to_owned()),
                    content: None,
                    payload: None,
                }),
            )
            .expect("reject finish");
        let other_runs = service
            .store
            .list_widget_runs_for_widget("other-widget")
            .expect("list other runs");
        let widget_logs = service
            .list_widget_logs(&workspace.id, workbench_id, &widget_id, 20)
            .expect("list widget logs")
            .expect("widget logs");
        let other_logs = service
            .list_widget_logs(&workspace.id, "other-workbench", "other-widget", 20)
            .expect("list other logs")
            .expect("other logs");
        let other_results = service
            .store
            .list_widget_results(&other_run.id)
            .expect("list other results");
        let stored_other_run = service
            .store
            .get_widget_run(&other_run.id)
            .expect("get other run")
            .expect("other run row");

        assert!(invalid_create.is_none());
        assert!(invalid_log.is_none());
        assert!(invalid_finish.is_none());
        assert_eq!(other_runs.len(), 1);
        assert_eq!(other_runs[0].id, other_run.id);
        assert_eq!(
            widget_log_messages(&widget_logs),
            vec![WIDGET_LOG_WIDGET_ADDED]
        );
        assert!(other_logs.is_empty());
        assert!(other_results.is_empty());
        assert_eq!(stored_other_run.status, "running");
        assert_eq!(stored_other_run.finished_at, None);
    }

    #[test]
    fn append_widget_run_log_persists_run_scoped_widget_log() {
        let service = initialized_service();
        let workspace = service
            .create_empty_workspace("Incident", None)
            .expect("create workspace");
        let workbench_id = workspace
            .workbench_id
            .as_deref()
            .expect("created workbench id");
        let state_after_add = service
            .add_widget_instance_to_workbench(
                &workspace.id,
                workbench_id,
                "terminal",
                "Terminal",
                "tool",
            )
            .expect("add widget")
            .expect("state after add");
        let widget_id = state_after_add.widget_instances[0].id.clone();
        let run = service
            .create_widget_run(
                &workspace.id,
                workbench_id,
                &widget_id,
                WidgetRunCommandInput {
                    command_kind: Some("preview".to_owned()),
                    command_payload: None,
                    summary: None,
                },
            )
            .expect("create run")
            .expect("run");

        let log = service
            .append_widget_run_log(
                &workspace.id,
                workbench_id,
                &widget_id,
                &run.id,
                "info",
                "Run lifecycle recorded",
                Some("{\"phase\":\"running\"}".to_owned()),
            )
            .expect("append run log")
            .expect("run log");
        let logs = service
            .list_widget_logs(&workspace.id, workbench_id, &widget_id, 20)
            .expect("list logs")
            .expect("logs");

        assert!(log.id.starts_with("wlog_"));
        assert_eq!(log.widget_instance_id, widget_id);
        assert_eq!(log.run_id.as_deref(), Some(run.id.as_str()));
        assert_eq!(log.level, "info");
        assert_eq!(log.message, "Run lifecycle recorded");
        assert_eq!(log.payload.as_deref(), Some("{\"phase\":\"running\"}"));
        assert!(logs.iter().any(|saved| saved.id == log.id));
    }

    #[test]
    fn finish_widget_run_persists_final_status_and_structured_result() {
        let service = initialized_service();
        let workspace = service
            .create_empty_workspace("Incident", None)
            .expect("create workspace");
        let workbench_id = workspace
            .workbench_id
            .as_deref()
            .expect("created workbench id");
        let state_after_add = service
            .add_widget_instance_to_workbench(
                &workspace.id,
                workbench_id,
                "agent-run",
                "Agent Monitoring",
                "agent",
            )
            .expect("add widget")
            .expect("state after add");
        let widget_id = state_after_add.widget_instances[0].id.clone();
        let run = service
            .create_widget_run(
                &workspace.id,
                workbench_id,
                &widget_id,
                WidgetRunCommandInput {
                    command_kind: Some("executor_preview".to_owned()),
                    command_payload: Some("{\"block\":108}".to_owned()),
                    summary: None,
                },
            )
            .expect("create run")
            .expect("run");

        let finished = service
            .finish_widget_run(
                &workspace.id,
                workbench_id,
                &widget_id,
                &run.id,
                WidgetRunStatus::Completed,
                Some("Lifecycle completed".to_owned()),
                Some(WidgetRunResultInput {
                    result_type: Some("result_report".to_owned()),
                    summary: Some("Result ready".to_owned()),
                    content: Some("No runtime was executed.".to_owned()),
                    payload: Some("{\"ok\":true}".to_owned()),
                }),
            )
            .expect("finish run")
            .expect("finished run");
        let read_back = service
            .get_widget_run(&workspace.id, workbench_id, &widget_id, &run.id)
            .expect("read run")
            .expect("run read model");

        assert_eq!(finished.run.id, run.id);
        assert_eq!(finished.run.status, "completed");
        assert!(finished.run.finished_at.is_some());
        assert_eq!(finished.run.summary.as_deref(), Some("Lifecycle completed"));
        assert_eq!(finished.results.len(), 1);
        assert!(finished.results[0].id.starts_with("wres_"));
        assert_eq!(finished.results[0].run_id, run.id);
        assert_eq!(finished.results[0].status, "completed");
        assert_eq!(finished.results[0].result_type, "result_report");
        assert_eq!(finished.results[0].summary.as_deref(), Some("Result ready"));
        assert_eq!(
            finished.results[0].content.as_deref(),
            Some("No runtime was executed.")
        );
        assert_eq!(read_back, finished);
    }

    #[test]
    fn finish_widget_run_rejects_non_final_status_without_result() {
        let service = initialized_service();
        let workspace = service
            .create_empty_workspace("Incident", None)
            .expect("create workspace");
        let workbench_id = workspace
            .workbench_id
            .as_deref()
            .expect("created workbench id");
        let state_after_add = service
            .add_widget_instance_to_workbench(
                &workspace.id,
                workbench_id,
                "agent-run",
                "Agent Monitoring",
                "agent",
            )
            .expect("add widget")
            .expect("state after add");
        let widget_id = state_after_add.widget_instances[0].id.clone();
        let run = service
            .create_widget_run(
                &workspace.id,
                workbench_id,
                &widget_id,
                WidgetRunCommandInput {
                    command_kind: Some("executor_preview".to_owned()),
                    command_payload: None,
                    summary: None,
                },
            )
            .expect("create run")
            .expect("run");

        let error = service
            .finish_widget_run(
                &workspace.id,
                workbench_id,
                &widget_id,
                &run.id,
                WidgetRunStatus::Running,
                Some("Should not finish".to_owned()),
                Some(WidgetRunResultInput {
                    result_type: Some("result_report".to_owned()),
                    summary: Some("Should not persist".to_owned()),
                    content: None,
                    payload: None,
                }),
            )
            .expect_err("reject non-final status");
        let stored_run = service
            .store
            .get_widget_run(&run.id)
            .expect("get run")
            .expect("run row");
        let results = service
            .store
            .list_widget_results(&run.id)
            .expect("list results");

        assert!(matches!(error, WorkspaceServiceError::InvalidInput(_)));
        assert_eq!(stored_run.status, "running");
        assert_eq!(stored_run.finished_at, None);
        assert!(results.is_empty());
    }

    fn docked_layout() -> WidgetInstanceLayout {
        WidgetInstanceLayout {
            layout_mode: "docked".to_owned(),
            dock_x: Some(12),
            dock_y: Some(24),
            dock_width: Some(480),
            dock_height: Some(320),
            popout_x: None,
            popout_y: None,
            popout_width: None,
            popout_height: None,
            always_on_top: false,
            is_visible: true,
        }
    }

    fn popped_out_layout() -> WidgetInstanceLayout {
        WidgetInstanceLayout {
            layout_mode: "popped_out".to_owned(),
            dock_x: Some(12),
            dock_y: Some(24),
            dock_width: Some(480),
            dock_height: Some(320),
            popout_x: Some(120),
            popout_y: Some(140),
            popout_width: Some(720),
            popout_height: Some(520),
            always_on_top: true,
            is_visible: true,
        }
    }

    fn git_status_fixture() -> ToolsGitRepositoryStatus {
        ToolsGitRepositoryStatus::from_changed_files(
            Some(ToolsGitBranchSummary {
                name: Some("main".to_owned()),
                upstream: Some("origin/main".to_owned()),
                ahead: Some(1),
                behind: None,
                is_detached: false,
            }),
            vec![ToolsGitFileChange {
                area: GitFileChangeArea::Staged,
                kind: GitFileChangeKind::Modified,
                path: "src/lib.rs".to_owned(),
                original_path: None,
            }],
            Vec::new(),
        )
    }

    fn workspace_ids(workspaces: &[WorkspaceSummary]) -> Vec<&str> {
        workspaces
            .iter()
            .map(|workspace| workspace.id.as_str())
            .collect()
    }

    fn workspace_workbench_ids(workspaces: &[WorkspaceSummary]) -> Vec<Option<&str>> {
        workspaces
            .iter()
            .map(|workspace| workspace.workbench_id.as_deref())
            .collect()
    }

    fn widget_log_messages(logs: &[WidgetLogSummary]) -> Vec<&str> {
        logs.iter().map(|log| log.message.as_str()).collect()
    }
}
