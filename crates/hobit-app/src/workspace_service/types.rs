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
