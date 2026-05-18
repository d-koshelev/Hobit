use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use hobit_app::CodexDirectStreamCancellationToken;
use tauri::Manager;

use crate::database_startup::initialize_database;

pub(crate) struct AppState {
    db_path: PathBuf,
    direct_work_active_runs: DirectWorkActiveRunRegistry,
}

impl AppState {
    fn new(db_path: PathBuf) -> Self {
        Self {
            db_path,
            direct_work_active_runs: DirectWorkActiveRunRegistry::default(),
        }
    }

    pub(crate) fn db_path(&self) -> &Path {
        &self.db_path
    }

    pub(crate) fn direct_work_active_runs(&self) -> DirectWorkActiveRunRegistry {
        self.direct_work_active_runs.clone()
    }
}

#[derive(Clone, Default)]
pub(crate) struct DirectWorkActiveRunRegistry {
    runs: Arc<Mutex<HashMap<String, DirectWorkActiveRun>>>,
}

impl DirectWorkActiveRunRegistry {
    pub(crate) fn register(&self, run: DirectWorkActiveRun) {
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

        run.cancellation_token.request_cancellation();
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

    Ok(AppState::new(database.path))
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
