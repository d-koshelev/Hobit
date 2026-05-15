mod agent_chat_ai_dto;
#[cfg(test)]
mod agent_chat_ai_dto_tests;
mod agent_chat_ai_provider;
mod agent_executor_diff_dto;
#[cfg(test)]
mod agent_executor_diff_dto_tests;
mod agent_executor_history_dto;
#[cfg(test)]
mod agent_executor_history_dto_tests;
mod agent_queue_dto;
#[cfg(test)]
mod agent_queue_dto_tests;
mod agent_queue_task_commands;
mod agent_queue_task_dto;
#[cfg(test)]
mod agent_queue_task_dto_tests;
mod app_state;
mod codex_direct_work_dto;
#[cfg(test)]
mod codex_direct_work_dto_tests;
mod git_commit_dto;
#[cfg(test)]
mod git_commit_dto_tests;
mod notes_commands;
mod notes_dto;
#[cfg(test)]
mod notes_dto_tests;
mod workspace_commands;
mod workspace_dto;
#[cfg(test)]
mod workspace_dto_tests;

use app_state::initialize_app_state;
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            app.manage(initialize_app_state(app)?);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            workspace_commands::create_workspace,
            workspace_commands::list_workspaces,
            workspace_commands::delete_workspace,
            workspace_commands::get_workspace_summary,
            workspace_commands::open_workspace,
            workspace_commands::get_workspace_workbench_state,
            workspace_commands::add_widget_instance_to_workbench,
            workspace_commands::update_widget_instance_state,
            workspace_commands::update_widget_instance_layout,
            workspace_commands::delete_widget_instance_from_workbench,
            workspace_commands::list_widget_logs,
            workspace_commands::list_agent_executor_runs,
            workspace_commands::get_agent_executor_run_detail,
            workspace_commands::get_agent_executor_diff_summary,
            workspace_commands::run_terminal_command,
            workspace_commands::run_codex_direct_work,
            workspace_commands::run_direct_work_validation,
            workspace_commands::start_codex_direct_work_stream,
            workspace_commands::cancel_codex_direct_work_run,
            workspace_commands::generate_agent_chat_ai_proposal,
            workspace_commands::persist_agent_chat_proposal,
            workspace_commands::get_agent_monitoring_snapshot,
            workspace_commands::create_agent_queue_item_from_proposal,
            workspace_commands::get_agent_queue_snapshot,
            workspace_commands::get_git_repository_status,
            workspace_commands::create_git_commit,
            notes_commands::create_workspace_note,
            notes_commands::list_workspace_notes,
            notes_commands::get_workspace_note,
            notes_commands::update_workspace_note,
            agent_queue_task_commands::create_agent_queue_task,
            agent_queue_task_commands::list_agent_queue_tasks,
            agent_queue_task_commands::get_agent_queue_task,
            agent_queue_task_commands::update_agent_queue_task,
            agent_queue_task_commands::assign_agent_queue_task_to_executor,
            agent_queue_task_commands::clear_agent_queue_task_assignment
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hobit desktop shell");
}
