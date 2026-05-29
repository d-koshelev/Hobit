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
mod agent_queue_execution_commands;
mod agent_queue_execution_dto;
#[cfg(test)]
mod agent_queue_execution_dto_tests;
mod agent_queue_runner;
mod agent_queue_runner_commands;
mod agent_queue_task_commands;
mod agent_queue_task_dto;
#[cfg(test)]
mod agent_queue_task_dto_tests;
mod app_state;
mod codex_direct_work_dto;
#[cfg(test)]
mod codex_direct_work_dto_tests;
mod coordinator_provider_commands;
mod coordinator_provider_dto;
#[cfg(test)]
mod coordinator_provider_dto_tests;
mod coordinator_provider_http;
mod database_startup;
mod direct_work_host_artifacts;
#[cfg(test)]
mod direct_work_host_artifacts_tests;
mod git_commit_dto;
#[cfg(test)]
mod git_commit_dto_tests;
mod git_review_dto;
#[cfg(test)]
mod git_review_dto_tests;
mod jdbc_connector_commands;
mod jdbc_connector_dto;
#[cfg(test)]
mod jdbc_connector_dto_tests;
mod jdbc_query_commands;
mod jdbc_query_dto;
#[cfg(test)]
mod jdbc_query_dto_tests;
mod knowledge_document_import_commands;
mod knowledge_document_import_dto;
#[cfg(test)]
mod knowledge_document_import_dto_tests;
mod knowledge_documents_commands;
mod knowledge_documents_dto;
#[cfg(test)]
mod knowledge_documents_dto_tests;
mod notes_commands;
mod notes_dto;
#[cfg(test)]
mod notes_dto_tests;
mod skills_commands;
mod skills_dto;
#[cfg(test)]
mod skills_dto_tests;
mod terminal_pty;
mod terminal_pty_artifacts;
#[cfg(test)]
mod terminal_pty_artifacts_tests;
mod terminal_pty_commands;
mod terminal_pty_dto;
#[cfg(test)]
mod terminal_pty_dto_tests;
#[cfg(target_os = "linux")]
mod terminal_pty_linux;
#[cfg(test)]
mod terminal_pty_tests;
#[cfg(not(any(windows, target_os = "linux")))]
mod terminal_pty_unsupported;
#[cfg(windows)]
mod terminal_pty_windows;
mod workspace_commands;
mod workspace_dto;
#[cfg(test)]
mod workspace_dto_tests;

use app_state::initialize_app_state;
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
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
            terminal_pty_commands::create_terminal_pty_session,
            terminal_pty_commands::write_terminal_pty_session,
            terminal_pty_commands::resize_terminal_pty_session,
            terminal_pty_commands::stop_terminal_pty_session,
            terminal_pty_commands::kill_terminal_pty_session,
            terminal_pty_commands::close_terminal_pty_session,
            terminal_pty_commands::get_terminal_pty_session,
            terminal_pty_commands::list_terminal_pty_sessions,
            workspace_commands::run_codex_direct_work,
            workspace_commands::run_direct_work_validation,
            workspace_commands::start_codex_direct_work_stream,
            workspace_commands::cancel_codex_direct_work_run,
            workspace_commands::force_kill_codex_direct_work_run,
            coordinator_provider_commands::generate_coordinator_provider_response,
            workspace_commands::generate_agent_chat_ai_proposal,
            workspace_commands::persist_agent_chat_proposal,
            workspace_commands::get_agent_monitoring_snapshot,
            workspace_commands::create_agent_queue_item_from_proposal,
            workspace_commands::get_agent_queue_snapshot,
            workspace_commands::get_git_repository_status,
            workspace_commands::get_git_file_diff,
            workspace_commands::get_git_log,
            workspace_commands::create_git_commit,
            notes_commands::create_workspace_note,
            notes_commands::list_workspace_notes,
            notes_commands::get_workspace_note,
            notes_commands::update_workspace_note,
            skills_commands::create_skill,
            skills_commands::list_skills,
            skills_commands::get_skill,
            skills_commands::update_skill,
            skills_commands::delete_skill,
            knowledge_documents_commands::create_knowledge_document,
            knowledge_documents_commands::list_knowledge_documents,
            knowledge_documents_commands::get_knowledge_document,
            knowledge_documents_commands::update_knowledge_document,
            knowledge_documents_commands::delete_knowledge_document,
            knowledge_documents_commands::search_knowledge_documents,
            knowledge_document_import_commands::read_knowledge_document_import_file,
            jdbc_connector_commands::create_jdbc_connector,
            jdbc_connector_commands::list_jdbc_connectors,
            jdbc_connector_commands::get_jdbc_connector,
            jdbc_connector_commands::update_jdbc_connector,
            jdbc_query_commands::validate_jdbc_read_only_sql,
            jdbc_query_commands::execute_jdbc_read_only_query,
            jdbc_query_commands::check_jdbc_sidecar_health,
            jdbc_query_commands::probe_jdbc_driver,
            jdbc_query_commands::create_jdbc_connection_profile,
            jdbc_query_commands::list_jdbc_connection_profiles,
            jdbc_query_commands::get_jdbc_connection_profile,
            jdbc_query_commands::update_jdbc_connection_profile,
            jdbc_query_commands::delete_jdbc_connection_profile,
            agent_queue_task_commands::create_agent_queue_task,
            agent_queue_task_commands::list_agent_queue_tasks,
            agent_queue_task_commands::get_agent_queue_task,
            agent_queue_task_commands::update_agent_queue_task,
            agent_queue_task_commands::assign_agent_queue_task_to_executor,
            agent_queue_task_commands::clear_agent_queue_task_assignment,
            agent_queue_task_commands::delete_agent_queue_task,
            agent_queue_execution_commands::start_assigned_agent_queue_task,
            agent_queue_execution_commands::get_agent_queue_task_latest_run_link,
            agent_queue_execution_commands::list_agent_queue_task_run_links,
            agent_queue_runner_commands::start_agent_queue_runner_session,
            agent_queue_runner_commands::stop_agent_queue_runner_session,
            agent_queue_runner_commands::get_agent_queue_runner_snapshot
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hobit desktop shell");
}
