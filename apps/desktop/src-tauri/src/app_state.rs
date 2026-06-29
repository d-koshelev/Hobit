use std::collections::HashMap;
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use hobit_app::CodexDirectStreamCancellationToken;
use tauri::Manager;

use crate::agent_queue_runner::QueueRunnerSessionRegistry;
use crate::database_startup::{initialize_database, initialize_database_without_override};
use crate::direct_work_host_artifacts::DirectWorkHostRuntimeBoundarySummary;
use crate::terminal_pty::TerminalPtySessionManager;

pub(crate) const HOBIT_DOGFOOD_PROFILE_ENV: &str = "HOBIT_DOGFOOD_PROFILE";
pub(crate) const HOBIT_DOGFOOD_PROFILE_DIR_ENV: &str = "HOBIT_DOGFOOD_PROFILE_DIR";
pub(crate) const HOBIT_APP_PROFILE_ENV: &str = "HOBIT_APP_PROFILE";
pub(crate) const HOBIT_DOGFOOD_WORKSPACE_ROOT_ENV: &str = "HOBIT_DOGFOOD_WORKSPACE_ROOT";

const APP_PROFILE_MODE_NORMAL: &str = "normal";
const APP_PROFILE_MODE_DOGFOOD: &str = "dogfood";
const DOGFOOD_PROFILE_DIR_NAME: &str = "dogfood-profile";

pub(crate) struct AppState {
    db_path: PathBuf,
    profile_mode: String,
    profile_data_dir: PathBuf,
    workspace_root: Option<String>,
    active_workspace: ActiveWorkspaceRegistry,
    direct_work_active_runs: DirectWorkActiveRunRegistry,
    queue_runner_sessions: QueueRunnerSessionRegistry,
    terminal_pty_sessions: TerminalPtySessionRegistry,
}

impl AppState {
    fn new(
        db_path: PathBuf,
        profile_mode: String,
        profile_data_dir: PathBuf,
        workspace_root: Option<String>,
    ) -> Self {
        Self {
            db_path,
            profile_mode,
            profile_data_dir,
            workspace_root,
            active_workspace: ActiveWorkspaceRegistry::default(),
            direct_work_active_runs: DirectWorkActiveRunRegistry::default(),
            queue_runner_sessions: QueueRunnerSessionRegistry::default(),
            terminal_pty_sessions: TerminalPtySessionRegistry::default(),
        }
    }

    pub(crate) fn db_path(&self) -> &Path {
        &self.db_path
    }

    pub(crate) fn profile_mode(&self) -> &str {
        &self.profile_mode
    }

    pub(crate) fn profile_data_dir(&self) -> &Path {
        &self.profile_data_dir
    }

    pub(crate) fn workspace_root(&self) -> Option<&str> {
        self.workspace_root.as_deref()
    }

    pub(crate) fn active_workspace(&self) -> ActiveWorkspaceRegistry {
        self.active_workspace.clone()
    }

    pub(crate) fn direct_work_active_runs(&self) -> DirectWorkActiveRunRegistry {
        self.direct_work_active_runs.clone()
    }

    pub(crate) fn queue_runner_sessions(&self) -> QueueRunnerSessionRegistry {
        self.queue_runner_sessions.clone()
    }

    pub(crate) fn terminal_pty_sessions(&self) -> TerminalPtySessionRegistry {
        self.terminal_pty_sessions.clone()
    }
}

pub(crate) type TerminalPtySessionRegistry = TerminalPtySessionManager;

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct ActiveWorkspaceContext {
    pub(crate) workspace_id: String,
    pub(crate) workspace_resolution_method: String,
    pub(crate) workspace_root: Option<String>,
}

#[derive(Clone, Default)]
pub(crate) struct ActiveWorkspaceRegistry {
    current: Arc<Mutex<Option<ActiveWorkspaceContext>>>,
}

impl ActiveWorkspaceRegistry {
    pub(crate) fn set(&self, workspace_id: impl Into<String>) {
        self.set_context(ActiveWorkspaceContext {
            workspace_id: workspace_id.into(),
            workspace_resolution_method: "app_current_workspace".to_owned(),
            workspace_root: None,
        });
    }

    pub(crate) fn set_context(&self, context: ActiveWorkspaceContext) {
        *self.current.lock().expect("active workspace lock") = Some(context);
    }

    pub(crate) fn clear_if(&self, workspace_id: &str) {
        let mut current = self.current.lock().expect("active workspace lock");
        if current
            .as_ref()
            .is_some_and(|context| context.workspace_id == workspace_id)
        {
            *current = None;
        }
    }

    pub(crate) fn current(&self) -> Option<ActiveWorkspaceContext> {
        self.current.lock().expect("active workspace lock").clone()
    }
}

#[derive(Clone, Default)]
pub(crate) struct DirectWorkActiveRunRegistry {
    runs: Arc<Mutex<HashMap<String, DirectWorkActiveRun>>>,
}

impl DirectWorkActiveRunRegistry {
    pub(crate) fn register(&self, run: DirectWorkActiveRun) {
        let _active_run_artifact =
            DirectWorkHostRuntimeBoundarySummary::from_active_run_status(&run.run_id, "active");
        self.runs
            .lock()
            .expect("direct work active run registry lock")
            .insert(run.run_id.clone(), run);
    }

    pub(crate) fn try_register(&self, run: DirectWorkActiveRun) -> bool {
        let _active_run_artifact =
            DirectWorkHostRuntimeBoundarySummary::from_active_run_status(&run.run_id, "active");
        let mut runs = self
            .runs
            .lock()
            .expect("direct work active run registry lock");
        if runs.contains_key(&run.run_id) {
            return false;
        }
        runs.insert(run.run_id.clone(), run);
        true
    }

    pub(crate) fn has_active_run(&self, run_id: &str) -> bool {
        self.runs
            .lock()
            .expect("direct work active run registry lock")
            .contains_key(run_id)
    }

    pub(crate) fn request_cancellation(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        widget_instance_id: &str,
        run_id: &str,
    ) -> bool {
        let runs = self
            .runs
            .lock()
            .expect("direct work active run registry lock");
        let Some(run) = runs.get(run_id) else {
            return false;
        };

        if run.workspace_id != workspace_id
            || run.workbench_id != workbench_id
            || run.widget_instance_id != widget_instance_id
        {
            return false;
        }

        let _cancellation_artifact =
            DirectWorkHostRuntimeBoundarySummary::from_status("cancellation_requested", None);
        run.cancellation_token.request_cancellation();
        true
    }

    pub(crate) fn request_force_kill(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        widget_instance_id: &str,
        run_id: &str,
    ) -> bool {
        let runs = self
            .runs
            .lock()
            .expect("direct work active run registry lock");
        let Some(run) = runs.get(run_id) else {
            return false;
        };

        if run.workspace_id != workspace_id
            || run.workbench_id != workbench_id
            || run.widget_instance_id != widget_instance_id
        {
            return false;
        }

        let _force_kill_artifact =
            DirectWorkHostRuntimeBoundarySummary::from_status("force_kill_requested", None);
        run.cancellation_token.request_force_kill();
        true
    }

    pub(crate) fn has_active_widget_run(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        widget_instance_id: &str,
    ) -> bool {
        self.runs
            .lock()
            .expect("direct work active run registry lock")
            .values()
            .any(|run| {
                run.workspace_id == workspace_id
                    && run.workbench_id == workbench_id
                    && run.widget_instance_id == widget_instance_id
            })
    }

    pub(crate) fn has_active_workspace_run(&self, workspace_id: &str) -> bool {
        self.runs
            .lock()
            .expect("direct work active run registry lock")
            .values()
            .any(|run| run.workspace_id == workspace_id)
    }

    pub(crate) fn unregister(&self, run_id: &str) {
        self.runs
            .lock()
            .expect("direct work active run registry lock")
            .remove(run_id);
    }
}

#[derive(Clone)]
pub(crate) struct DirectWorkActiveRun {
    run_id: String,
    workspace_id: String,
    workbench_id: String,
    widget_instance_id: String,
    cancellation_token: CodexDirectStreamCancellationToken,
}

impl DirectWorkActiveRun {
    pub(crate) fn new(
        run_id: String,
        workspace_id: String,
        workbench_id: String,
        widget_instance_id: String,
        cancellation_token: CodexDirectStreamCancellationToken,
    ) -> Self {
        let _active_run_artifact =
            DirectWorkHostRuntimeBoundarySummary::from_active_run_status(&run_id, "starting");
        Self {
            run_id,
            workspace_id,
            workbench_id,
            widget_instance_id,
            cancellation_token,
        }
    }
}

pub(crate) fn initialize_app_state<R: tauri::Runtime>(
    app: &tauri::App<R>,
) -> Result<AppState, Box<dyn std::error::Error>> {
    let app_data_dir = app.path().app_data_dir()?;
    let profile = select_app_profile(&app_data_dir);
    let database = if profile.honor_database_override {
        initialize_database(&profile.data_dir)?
    } else {
        initialize_database_without_override(&profile.data_dir)?
    };
    let workspace_root = std::env::var_os(HOBIT_DOGFOOD_WORKSPACE_ROOT_ENV)
        .map(PathBuf::from)
        .or_else(|| std::env::current_dir().ok())
        .and_then(|path| normalize_workspace_root(path.to_string_lossy().as_ref()));

    Ok(AppState::new(
        database.path,
        profile.mode,
        profile.data_dir,
        workspace_root,
    ))
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct AppProfileSelection {
    mode: String,
    data_dir: PathBuf,
    honor_database_override: bool,
}

fn select_app_profile(default_app_data_dir: &Path) -> AppProfileSelection {
    select_app_profile_from_env(
        default_app_data_dir,
        std::env::var_os(HOBIT_DOGFOOD_PROFILE_ENV),
        std::env::var_os(HOBIT_APP_PROFILE_ENV),
        std::env::var_os(HOBIT_DOGFOOD_PROFILE_DIR_ENV),
        std::env::var_os("LOCALAPPDATA"),
    )
}

fn select_app_profile_from_env(
    default_app_data_dir: &Path,
    dogfood_profile: Option<OsString>,
    app_profile: Option<OsString>,
    dogfood_profile_dir: Option<OsString>,
    local_app_data: Option<OsString>,
) -> AppProfileSelection {
    if dogfood_profile_enabled(dogfood_profile.as_ref())
        || app_profile
            .as_ref()
            .is_some_and(|value| value.to_string_lossy().eq_ignore_ascii_case("dogfood"))
    {
        return AppProfileSelection {
            mode: APP_PROFILE_MODE_DOGFOOD.to_owned(),
            data_dir: dogfood_profile_data_dir(
                default_app_data_dir,
                dogfood_profile_dir,
                local_app_data,
            ),
            honor_database_override: false,
        };
    }

    AppProfileSelection {
        mode: APP_PROFILE_MODE_NORMAL.to_owned(),
        data_dir: default_app_data_dir.to_path_buf(),
        honor_database_override: true,
    }
}

fn dogfood_profile_enabled(value: Option<&OsString>) -> bool {
    value.is_some_and(|value| {
        let value = value.to_string_lossy();
        matches!(
            value.trim().to_ascii_lowercase().as_str(),
            "1" | "true" | "yes" | "dogfood"
        )
    })
}

fn dogfood_profile_data_dir(
    default_app_data_dir: &Path,
    dogfood_profile_dir: Option<OsString>,
    local_app_data: Option<OsString>,
) -> PathBuf {
    if let Some(profile_dir) = dogfood_profile_dir.filter(|value| !value.is_empty()) {
        return PathBuf::from(profile_dir);
    }
    if let Some(local_app_data) = local_app_data.filter(|value| !value.is_empty()) {
        return PathBuf::from(local_app_data)
            .join("com.hobit.desktop")
            .join(DOGFOOD_PROFILE_DIR_NAME);
    }
    default_app_data_dir.join(DOGFOOD_PROFILE_DIR_NAME)
}

fn normalize_workspace_root(value: &str) -> Option<String> {
    let trimmed = value.trim();

    if trimmed.is_empty() || trimmed == "~" || trimmed == "." {
        return None;
    }

    Some(trimmed.to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn active_run_registry_requests_matching_cancellation_and_unregisters() {
        let registry = DirectWorkActiveRunRegistry::default();
        let token = CodexDirectStreamCancellationToken::new();
        registry.register(DirectWorkActiveRun::new(
            "run_1".to_owned(),
            "ws_1".to_owned(),
            "wb_1".to_owned(),
            "wid_1".to_owned(),
            token.clone(),
        ));

        assert!(!registry.request_cancellation("other", "wb_1", "wid_1", "run_1"));
        assert!(!token.is_cancellation_requested());
        assert!(registry.request_cancellation("ws_1", "wb_1", "wid_1", "run_1"));
        assert!(token.is_cancellation_requested());

        registry.unregister("run_1");

        assert!(!registry.request_cancellation("ws_1", "wb_1", "wid_1", "run_1"));
        assert!(!registry.has_active_widget_run("ws_1", "wb_1", "wid_1"));
    }

    #[test]
    fn active_run_registry_requests_matching_force_kill() {
        let registry = DirectWorkActiveRunRegistry::default();
        let token = CodexDirectStreamCancellationToken::new();
        registry.register(DirectWorkActiveRun::new(
            "run_1".to_owned(),
            "ws_1".to_owned(),
            "wb_1".to_owned(),
            "wid_1".to_owned(),
            token.clone(),
        ));

        assert!(!registry.request_force_kill("other", "wb_1", "wid_1", "run_1"));
        assert!(!token.is_force_kill_requested());
        assert!(registry.request_force_kill("ws_1", "wb_1", "wid_1", "run_1"));
        assert!(token.is_force_kill_requested());
        assert!(token.is_cancellation_requested());
    }

    #[test]
    fn active_run_registry_reports_matching_widget_activity() {
        let registry = DirectWorkActiveRunRegistry::default();
        registry.register(DirectWorkActiveRun::new(
            "run_1".to_owned(),
            "ws_1".to_owned(),
            "wb_1".to_owned(),
            "wid_1".to_owned(),
            CodexDirectStreamCancellationToken::new(),
        ));

        assert!(registry.has_active_widget_run("ws_1", "wb_1", "wid_1"));
        assert!(!registry.has_active_widget_run("ws_1", "other", "wid_1"));
        assert!(registry.has_active_workspace_run("ws_1"));
        assert!(!registry.has_active_workspace_run("other"));
    }

    #[test]
    fn active_workspace_registry_tracks_and_clears_current_workspace() {
        let registry = ActiveWorkspaceRegistry::default();
        assert_eq!(registry.current(), None);

        registry.set("ws_1");
        assert_eq!(
            registry.current(),
            Some(ActiveWorkspaceContext {
                workspace_id: "ws_1".to_owned(),
                workspace_resolution_method: "app_current_workspace".to_owned(),
                workspace_root: None,
            })
        );

        registry.clear_if("other");
        assert_eq!(
            registry.current(),
            Some(ActiveWorkspaceContext {
                workspace_id: "ws_1".to_owned(),
                workspace_resolution_method: "app_current_workspace".to_owned(),
                workspace_root: None,
            })
        );

        registry.clear_if("ws_1");
        assert_eq!(registry.current(), None);
    }

    #[test]
    fn dogfood_operator_profile_selection_keeps_normal_profile_unchanged() {
        let default_dir = PathBuf::from("default-app-data");

        let profile = select_app_profile_from_env(&default_dir, None, None, None, None);

        assert_eq!(
            profile,
            AppProfileSelection {
                mode: APP_PROFILE_MODE_NORMAL.to_owned(),
                data_dir: default_dir,
                honor_database_override: true,
            }
        );
    }

    #[test]
    fn dogfood_operator_profile_selection_uses_persistent_dogfood_profile_path() {
        let default_dir = PathBuf::from("default-app-data");
        let local_app_data = PathBuf::from("local-app-data");

        let profile = select_app_profile_from_env(
            &default_dir,
            Some(OsString::from("1")),
            None,
            None,
            Some(local_app_data.clone().into_os_string()),
        );

        assert_eq!(profile.mode, APP_PROFILE_MODE_DOGFOOD);
        assert_eq!(
            profile.data_dir,
            local_app_data
                .join("com.hobit.desktop")
                .join(DOGFOOD_PROFILE_DIR_NAME)
        );
        assert!(!profile.honor_database_override);
        assert!(!profile.data_dir.starts_with(std::env::temp_dir()));
    }

    #[test]
    fn dogfood_operator_profile_selection_accepts_named_dogfood_profile() {
        let default_dir = PathBuf::from("default-app-data");
        let local_app_data = PathBuf::from("local-app-data");

        let profile = select_app_profile_from_env(
            &default_dir,
            None,
            Some(OsString::from("dogfood")),
            None,
            Some(local_app_data.clone().into_os_string()),
        );

        assert_eq!(profile.mode, APP_PROFILE_MODE_DOGFOOD);
        assert_eq!(
            profile.data_dir,
            local_app_data
                .join("com.hobit.desktop")
                .join(DOGFOOD_PROFILE_DIR_NAME)
        );
    }

    #[test]
    fn dogfood_operator_profile_selection_accepts_explicit_profile_dir_hint() {
        let default_dir = PathBuf::from("default-app-data");
        let profile_dir = PathBuf::from("local-app-data")
            .join("com.hobit.desktop")
            .join(DOGFOOD_PROFILE_DIR_NAME);

        let profile = select_app_profile_from_env(
            &default_dir,
            Some(OsString::from("1")),
            None,
            Some(profile_dir.clone().into_os_string()),
            None,
        );

        assert_eq!(profile.mode, APP_PROFILE_MODE_DOGFOOD);
        assert_eq!(profile.data_dir, profile_dir);
        assert!(!profile.honor_database_override);
    }

    #[test]
    fn active_run_registry_try_register_rejects_duplicate_run_id() {
        let registry = DirectWorkActiveRunRegistry::default();
        assert!(registry.try_register(DirectWorkActiveRun::new(
            "run_1".to_owned(),
            "ws_1".to_owned(),
            "wb_1".to_owned(),
            "wid_1".to_owned(),
            CodexDirectStreamCancellationToken::new(),
        )));
        assert!(!registry.try_register(DirectWorkActiveRun::new(
            "run_1".to_owned(),
            "ws_1".to_owned(),
            "wb_1".to_owned(),
            "wid_1".to_owned(),
            CodexDirectStreamCancellationToken::new(),
        )));
        assert!(registry.has_active_run("run_1"));
    }
}
