use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use hobit_app::CodexDirectStreamCancellationToken;
use tauri::Manager;

use crate::agent_queue_runner::QueueRunnerSessionRegistry;
use crate::database_startup::initialize_database;
use crate::direct_work_host_artifacts::DirectWorkHostRuntimeBoundarySummary;
use crate::terminal_pty::TerminalPtySessionManager;

pub(crate) struct AppState {
    db_path: PathBuf,
    workspace_root: Option<String>,
    direct_work_active_runs: DirectWorkActiveRunRegistry,
    queue_runner_sessions: QueueRunnerSessionRegistry,
    terminal_pty_sessions: TerminalPtySessionRegistry,
}

impl AppState {
    fn new(db_path: PathBuf, workspace_root: Option<String>) -> Self {
        Self {
            db_path,
            workspace_root,
            direct_work_active_runs: DirectWorkActiveRunRegistry::default(),
            queue_runner_sessions: QueueRunnerSessionRegistry::default(),
            terminal_pty_sessions: TerminalPtySessionRegistry::default(),
        }
    }

    pub(crate) fn db_path(&self) -> &Path {
        &self.db_path
    }

    pub(crate) fn workspace_root(&self) -> Option<&str> {
        self.workspace_root.as_deref()
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
    let database = initialize_database(&app_data_dir)?;
    let workspace_root = std::env::current_dir()
        .ok()
        .and_then(|path| normalize_workspace_root(path.to_string_lossy().as_ref()));

    Ok(AppState::new(database.path, workspace_root))
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
}
