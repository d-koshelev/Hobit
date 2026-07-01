use std::env;
use std::ffi::OsString;
use std::fmt;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use hobit_storage_sqlite::SqliteStore;

pub(crate) const HOBIT_DATABASE_PATH_ENV: &str = "HOBIT_DATABASE_PATH";

const DEFAULT_DATABASE_FILE_NAME: &str = "hobit.sqlite3";

pub(crate) struct InitializedDatabase {
    pub(crate) path: PathBuf,
}

#[derive(Debug)]
pub(crate) enum DatabaseStartupError {
    EmptyOverride,
    DatabasePathIsDirectory {
        db_path: PathBuf,
        parent_dir: PathBuf,
    },
    OperationFailed {
        db_path: PathBuf,
        parent_dir: PathBuf,
        operation: &'static str,
        source: String,
    },
}

impl fmt::Display for DatabaseStartupError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptyOverride => write!(
                formatter,
                "Hobit database path is invalid: {HOBIT_DATABASE_PATH_ENV} is empty. \
Set {HOBIT_DATABASE_PATH_ENV} to a writable SQLite file path for development, or unset it to use the Tauri app-data directory."
            ),
            Self::DatabasePathIsDirectory {
                db_path,
                parent_dir,
            } => write!(
                formatter,
                "Hobit database is not writable: {}. Parent directory: {}. \
Operation: verify database file path. Cause: the database path is a directory. \
Likely cause: {HOBIT_DATABASE_PATH_ENV} or the app-data database path points at a directory instead of a SQLite file. \
Remediation: choose a writable SQLite file path, or unset {HOBIT_DATABASE_PATH_ENV} to use the Tauri app-data directory.",
                db_path.display(),
                parent_dir.display()
            ),
            Self::OperationFailed {
                db_path,
                parent_dir,
                operation,
                source,
            } => write!(
                formatter,
                "Hobit database is not writable: {}. Parent directory: {}. \
Operation: {operation}. Cause: {source}. \
Likely cause: the database file or parent directory is read-only or inaccessible. \
Remediation: check file permissions, or set {HOBIT_DATABASE_PATH_ENV} to a writable SQLite file path for development.",
                db_path.display(),
                parent_dir.display()
            ),
        }
    }
}

impl std::error::Error for DatabaseStartupError {}

pub(crate) fn initialize_database(
    default_app_data_dir: &Path,
) -> Result<InitializedDatabase, DatabaseStartupError> {
    initialize_database_with_override(default_app_data_dir, env::var_os(HOBIT_DATABASE_PATH_ENV))
}

pub(crate) fn initialize_database_without_override(
    default_app_data_dir: &Path,
) -> Result<InitializedDatabase, DatabaseStartupError> {
    initialize_database_with_override(default_app_data_dir, None)
}

fn initialize_database_with_override(
    default_app_data_dir: &Path,
    override_path: Option<OsString>,
) -> Result<InitializedDatabase, DatabaseStartupError> {
    let db_path = resolve_database_path(default_app_data_dir, override_path)?;
    prepare_database_path(&db_path)?;

    let store = SqliteStore::open(&db_path)
        .map_err(|error| operation_failed(&db_path, "open SQLite database", error.to_string()))?;
    store.init_schema().map_err(|error| {
        operation_failed(&db_path, "initialize SQLite schema", error.to_string())
    })?;

    Ok(InitializedDatabase { path: db_path })
}

fn resolve_database_path(
    default_app_data_dir: &Path,
    override_path: Option<OsString>,
) -> Result<PathBuf, DatabaseStartupError> {
    match override_path {
        Some(value) if value.is_empty() => Err(DatabaseStartupError::EmptyOverride),
        Some(value) => Ok(PathBuf::from(value)),
        None => Ok(default_app_data_dir.join(DEFAULT_DATABASE_FILE_NAME)),
    }
}

fn prepare_database_path(db_path: &Path) -> Result<(), DatabaseStartupError> {
    let parent_dir = database_parent_dir(db_path);
    fs::create_dir_all(&parent_dir).map_err(|error| {
        operation_failed(
            db_path,
            "create database parent directory",
            error.to_string(),
        )
    })?;

    if db_path.is_dir() {
        return Err(DatabaseStartupError::DatabasePathIsDirectory {
            db_path: db_path.to_path_buf(),
            parent_dir,
        });
    }

    if db_path.exists() {
        OpenOptions::new()
            .read(true)
            .write(true)
            .open(db_path)
            .map_err(|error| {
                operation_failed(
                    db_path,
                    "open existing database for read/write",
                    error.to_string(),
                )
            })?;
        return Ok(());
    }

    verify_parent_directory_writable(db_path, &parent_dir)
}

fn verify_parent_directory_writable(
    db_path: &Path,
    parent_dir: &Path,
) -> Result<(), DatabaseStartupError> {
    let probe_path = parent_dir.join(format!(
        ".hobit-db-write-check-{}-{}.tmp",
        std::process::id(),
        unique_suffix()
    ));

    let write_result = (|| {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&probe_path)?;
        file.write_all(b"hobit database write check")?;
        file.sync_all()
    })();

    let remove_result = fs::remove_file(&probe_path);

    write_result
        .map_err(|error| {
            operation_failed(
                db_path,
                "write to database parent directory",
                error.to_string(),
            )
        })
        .and_then(|_| {
            remove_result.map_err(|error| {
                operation_failed(
                    db_path,
                    "remove database write-check file",
                    error.to_string(),
                )
            })
        })
}

fn database_parent_dir(db_path: &Path) -> PathBuf {
    db_path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."))
}

fn operation_failed(
    db_path: &Path,
    operation: &'static str,
    source: String,
) -> DatabaseStartupError {
    DatabaseStartupError::OperationFailed {
        db_path: db_path.to_path_buf(),
        parent_dir: database_parent_dir(db_path),
        operation,
        source,
    }
}

fn unique_suffix() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_database_path_uses_default_app_data_dir() {
        let default_dir = PathBuf::from("default-app-data");

        let resolved = resolve_database_path(&default_dir, None).expect("resolve default path");

        assert_eq!(resolved, default_dir.join(DEFAULT_DATABASE_FILE_NAME));
    }

    #[test]
    fn resolve_database_path_uses_explicit_override() {
        let default_dir = PathBuf::from("default-app-data");
        let override_path = PathBuf::from("override").join("hobit-dev.sqlite3");

        let resolved =
            resolve_database_path(&default_dir, Some(override_path.clone().into_os_string()))
                .expect("resolve override path");

        assert_eq!(resolved, override_path);
    }

    #[test]
    fn resolve_database_path_rejects_empty_override() {
        let error = resolve_database_path(Path::new("default"), Some(OsString::new()))
            .expect_err("empty override should fail");

        assert!(error.to_string().contains(HOBIT_DATABASE_PATH_ENV));
    }

    #[test]
    fn initialize_database_creates_parent_directory_and_schema() {
        let root = temp_test_dir("creates-parent");
        let db_path = root.join("nested").join("hobit-test.sqlite3");

        let initialized =
            initialize_database_with_override(&root, Some(db_path.clone().into_os_string()))
                .expect("initialize database");

        assert_eq!(initialized.path, db_path);
        assert!(db_path.exists());

        cleanup_temp_test_dir(&root);
    }

    #[test]
    fn dogfood_operator_profile_database_without_override_uses_profile_directory() {
        let root = temp_test_dir("dogfood-profile");

        let initialized =
            initialize_database_without_override(&root).expect("initialize profile database");

        assert_eq!(initialized.path, root.join(DEFAULT_DATABASE_FILE_NAME));
        assert!(initialized.path.exists());

        cleanup_temp_test_dir(&root);
    }

    #[test]
    fn prepare_database_path_reports_directory_database_path() {
        let root = temp_test_dir("directory-db-path");
        let db_path = root.join("hobit-test.sqlite3");
        fs::create_dir_all(&db_path).expect("create directory at db path");

        let error = prepare_database_path(&db_path).expect_err("directory path should fail");
        let message = error.to_string();

        assert!(message.contains("Hobit database is not writable"));
        assert!(message.contains("verify database file path"));
        assert!(message.contains(&db_path.display().to_string()));
        assert!(message.contains(&root.display().to_string()));

        cleanup_temp_test_dir(&root);
    }

    fn temp_test_dir(name: &str) -> PathBuf {
        let path = env::temp_dir().join(format!(
            "hobit-db-startup-{name}-{}-{}",
            std::process::id(),
            unique_suffix()
        ));
        fs::create_dir_all(&path).expect("create temp test directory");
        path
    }

    fn cleanup_temp_test_dir(path: &Path) {
        fs::remove_dir_all(path).expect("remove temp test directory");
    }
}
