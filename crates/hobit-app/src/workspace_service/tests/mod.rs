use super::*;
use std::path::PathBuf;

use hobit_tools::git::{
    GitBranchSummary as ToolsGitBranchSummary, GitFileChange as ToolsGitFileChange,
    GitFileChangeArea, GitFileChangeKind, GitRepositoryStatus as ToolsGitRepositoryStatus,
};

use crate::WorkspaceServiceError;

use std::cell::RefCell;

use hobit_storage_sqlite::{NewSharedStateObject, NewWidgetInstance, NewWidgetLog};

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

mod git_status;
mod widget_instances;
mod widget_logs;
mod widget_runs;
mod workbench_state;
mod workspace_lifecycle;

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
