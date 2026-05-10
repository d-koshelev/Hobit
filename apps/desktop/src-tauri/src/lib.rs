mod app_state;
mod workspace_commands;
mod workspace_dto;

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
            workspace_commands::get_workspace_summary,
            workspace_commands::open_workspace,
            workspace_commands::get_workspace_workbench_state,
            workspace_commands::add_widget_instance_to_workbench,
            workspace_commands::update_widget_instance_state,
            workspace_commands::update_widget_instance_layout,
            workspace_commands::list_widget_logs
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hobit desktop shell");
}
