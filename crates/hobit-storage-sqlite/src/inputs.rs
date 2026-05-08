//! Input structs accepted by SQLite store mutation methods.

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewWorkspaceSession<'a> {
    pub id: &'a str,
    pub workspace_id: &'a str,
    pub status: &'a str,
    pub opened_at: Option<&'a str>,
    pub closed_at: Option<&'a str>,
    pub active_widget_id: Option<&'a str>,
    pub current_focus_kind: Option<&'a str>,
    pub current_focus_ref: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewWidgetInstance<'a> {
    pub id: &'a str,
    pub workspace_id: &'a str,
    pub workbench_id: &'a str,
    pub definition_id: &'a str,
    pub title: &'a str,
    pub category: &'a str,
    pub layout_mode: &'a str,
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
    pub config: Option<&'a str>,
    pub state: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewWidgetRun<'a> {
    pub id: &'a str,
    pub widget_instance_id: &'a str,
    pub status: &'a str,
    pub command_kind: Option<&'a str>,
    pub command_payload: Option<&'a str>,
    pub started_at: Option<&'a str>,
    pub finished_at: Option<&'a str>,
    pub summary: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewWidgetLog<'a> {
    pub id: &'a str,
    pub widget_instance_id: &'a str,
    pub run_id: Option<&'a str>,
    pub level: &'a str,
    pub message: &'a str,
    pub created_at: Option<&'a str>,
    pub details: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewWidgetResult<'a> {
    pub id: &'a str,
    pub run_id: &'a str,
    pub status: &'a str,
    pub result_type: Option<&'a str>,
    pub summary: Option<&'a str>,
    pub content: Option<&'a str>,
    pub payload: Option<&'a str>,
    pub created_at: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewSharedStateObject<'a> {
    pub id: &'a str,
    pub workspace_id: &'a str,
    pub key: &'a str,
    pub value: &'a str,
    pub value_kind: &'a str,
}
