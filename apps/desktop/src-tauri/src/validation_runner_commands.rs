use std::path::{Path, PathBuf};

use hobit_app::WorkspaceService;
use hobit_storage_sqlite::SqliteStore;
use tauri::State;

use crate::app_state::AppState;
use crate::validation_runner_dto::{QueueValidationSuiteRunDto, RunQueueValidationSuiteRequest};

#[tauri::command]
pub(crate) fn run_queue_validation_suite(
    request: RunQueueValidationSuiteRequest,
    state: State<'_, AppState>,
) -> Result<QueueValidationSuiteRunDto, String> {
    run_queue_validation_suite_blocking(request, state.db_path().to_path_buf())
}

fn run_queue_validation_suite_blocking(
    request: RunQueueValidationSuiteRequest,
    db_path: PathBuf,
) -> Result<QueueValidationSuiteRunDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .run_agent_queue_validation_suite(request.into())
        .map(QueueValidationSuiteRunDto::from)
        .map_err(command_error)
}

fn workspace_service(db_path: &Path) -> Result<WorkspaceService, String> {
    SqliteStore::open(db_path)
        .map(WorkspaceService::new)
        .map_err(command_error)
}

fn command_error(error: impl std::fmt::Display) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_validation_request_to_app_input() {
        let request = RunQueueValidationSuiteRequest {
            workspace_id: "workspace-1".to_owned(),
            queue_item_id: "queue-1".to_owned(),
            requested_by_surface: "queue".to_owned(),
            cwd: "C:/repo".to_owned(),
            stop_on_first_failure: true,
            commands: vec![
                crate::validation_runner_dto::QueueValidationCommandSpecRequest {
                    command_id: "typecheck".to_owned(),
                    title: "Typecheck".to_owned(),
                    program: "npm.cmd".to_owned(),
                    args: vec!["run".to_owned(), "typecheck".to_owned()],
                    cwd: "C:/repo".to_owned(),
                    timeout_ms: Some(10_000),
                    stdout_cap_bytes: Some(100),
                    stderr_cap_bytes: Some(200),
                    allowed_exit_codes: vec![0],
                    safety_category: "build_or_test".to_owned(),
                    source: "manual".to_owned(),
                },
            ],
        };

        let input: hobit_app::RunAgentQueueValidationSuiteInput = request.into();

        assert_eq!(input.workspace_id, "workspace-1");
        assert_eq!(input.queue_item_id, "queue-1");
        assert_eq!(input.requested_by_surface, "queue");
        assert!(input.stop_on_first_failure);
        assert_eq!(input.commands[0].program, "npm.cmd");
        assert_eq!(input.commands[0].args, vec!["run", "typecheck"]);
        assert_eq!(input.commands[0].stdout_cap_bytes, Some(100));
    }
}
