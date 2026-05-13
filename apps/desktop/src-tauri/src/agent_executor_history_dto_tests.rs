use hobit_app::{
    AgentExecutorRunDetail, AgentExecutorRunHistory, AgentExecutorRunSummary, WidgetLogSummary,
};

use crate::agent_executor_history_dto::{AgentExecutorRunDetailDto, AgentExecutorRunHistoryDto};

#[test]
fn maps_agent_executor_run_history_to_dto() {
    let dto = AgentExecutorRunHistoryDto::from(AgentExecutorRunHistory {
        workspace_id: "ws_1".to_owned(),
        workbench_id: "wb_1".to_owned(),
        widget_instance_id: "wid_1".to_owned(),
        runs: vec![summary_fixture()],
    });

    assert_eq!(dto.workspace_id, "ws_1");
    assert_eq!(dto.workbench_id, "wb_1");
    assert_eq!(dto.widget_instance_id, "wid_1");
    assert_eq!(dto.runs.len(), 1);
    assert_eq!(dto.runs[0].run_id, "run_1");
    assert_eq!(dto.runs[0].mode.as_deref(), Some("direct_work"));
    assert_eq!(dto.runs[0].repo_root.as_deref(), Some("C:/work/repo"));
    assert_eq!(dto.runs[0].duration_ms, Some(42));
    assert!(dto.runs[0].has_result);
}

#[test]
fn maps_agent_executor_run_detail_to_dto() {
    let dto = AgentExecutorRunDetailDto::from(AgentExecutorRunDetail {
        summary: summary_fixture(),
        result_id: Some("result_1".to_owned()),
        result_status: Some("completed".to_owned()),
        result_summary: Some("Codex Direct Work completed".to_owned()),
        result_content: Some("Final response".to_owned()),
        result_payload: Some("{\"mode\":\"direct_work\"}".to_owned()),
        final_message: Some("Final response".to_owned()),
        stdout_preview: Some("stdout".to_owned()),
        stderr_preview: Some("stderr".to_owned()),
        error_message: None,
        validation_profile: None,
        validation_status: None,
        changed_files_summary: Some("[\"src/lib.rs\"]".to_owned()),
        logs: vec![WidgetLogSummary {
            id: "log_1".to_owned(),
            widget_instance_id: "wid_1".to_owned(),
            run_id: Some("run_1".to_owned()),
            level: "info".to_owned(),
            message: "Codex process completed".to_owned(),
            payload: Some("{\"status\":\"completed\"}".to_owned()),
            created_at: "1".to_owned(),
        }],
    });

    assert_eq!(dto.summary.run_id, "run_1");
    assert_eq!(dto.result_id.as_deref(), Some("result_1"));
    assert_eq!(dto.final_message.as_deref(), Some("Final response"));
    assert_eq!(
        dto.changed_files_summary.as_deref(),
        Some("[\"src/lib.rs\"]")
    );
    assert_eq!(dto.logs.len(), 1);
    assert_eq!(dto.logs[0].run_id.as_deref(), Some("run_1"));
    assert_eq!(dto.logs[0].message, "Codex process completed");
}

fn summary_fixture() -> AgentExecutorRunSummary {
    AgentExecutorRunSummary {
        run_id: "run_1".to_owned(),
        status: "completed".to_owned(),
        command_kind: Some("codex_direct_work".to_owned()),
        result_type: Some("codex_direct_work_result".to_owned()),
        started_at: "1".to_owned(),
        finished_at: Some("2".to_owned()),
        duration_ms: Some(42),
        title: "Codex Direct Work completed".to_owned(),
        repo_root: Some("C:/work/repo".to_owned()),
        mode: Some("direct_work".to_owned()),
        validation_profile: None,
        validation_status: None,
        has_result: true,
        log_count: Some(4),
    }
}
