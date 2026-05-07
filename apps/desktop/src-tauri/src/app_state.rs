use std::path::{Path, PathBuf};

use hobit_storage_sqlite::SqliteStore;
use tauri::Manager;

pub(crate) struct AppState {
    db_path: PathBuf,
}

impl AppState {
    fn new(db_path: PathBuf) -> Self {
        Self { db_path }
    }

    pub(crate) fn db_path(&self) -> &Path {
        &self.db_path
    }
}

pub(crate) fn initialize_app_state<R: tauri::Runtime>(
    app: &tauri::App<R>,
) -> Result<AppState, Box<dyn std::error::Error>> {
    let app_data_dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&app_data_dir)?;

    let db_path = app_data_dir.join("hobit.sqlite3");
    let store = SqliteStore::open(&db_path)?;
    store.init_schema()?;

    Ok(AppState::new(db_path))
}
