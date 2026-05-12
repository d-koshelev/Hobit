use std::path::PathBuf;

use hobit_app::{
    AgentChatProposalRunSummary, GitBranchStatusSummary, GitFileChangeSummary,
    GitLastCommitSummary, GitRepositoryStatusSummary, GitWorkingTreeStatusSummary,
    PersistAgentChatProposalInput, RunTerminalCommandInput, SharedStateObjectSummary,
    TerminalCommandRunSummary, WidgetInstanceSummary, WidgetLogSummary, WorkbenchEventSummary,
    WorkbenchSummary, WorkspaceSessionSummary, WorkspaceSummary, WorkspaceWorkbenchState,
};
use hobit_app::{
    AgentMonitoringProposalActionSummary, AgentMonitoringProposalResultSummary,
    AgentMonitoringSnapshot,
};

use crate::workspace_dto::{
    AgentChatProposalActionRequest, AgentChatProposalRequest, AgentMonitoringSnapshotDto,
    GetAgentMonitoringSnapshotRequest, GitRepositoryStatusDto, PersistAgentChatProposalRequest,
    PersistAgentChatProposalResponseDto, RunTerminalCommandRequest, RunTerminalCommandResponseDto,
    WidgetLogDto, WorkspaceSessionSummaryDto, WorkspaceSummaryDto, WorkspaceWorkbenchStateDto,
};

#[test]
fn maps_workspace_summary_to_dto() {
    let summary = WorkspaceSummary {
        id: "ws_1".to_owned(),
        title: "Incident".to_owned(),
        description: Some("Investigate".to_owned()),
        status: "active".to_owned(),
        workbench_id: Some("wb_1".to_owned()),
    };

    let dto = WorkspaceSummaryDto::from(summary);

    assert_eq!(
        dto,
        WorkspaceSummaryDto {
            id: "ws_1".to_owned(),
            title: "Incident".to_owned(),
            description: Some("Investigate".to_owned()),
            status: "active".to_owned(),
            workbench_id: Some("wb_1".to_owned()),
        }
    );
}

#[test]
fn maps_workspace_session_summary_to_dto() {
    let summary = WorkspaceSessionSummary {
        id: "wss_1".to_owned(),
        workspace_id: "ws_1".to_owned(),
        status: "open".to_owned(),
        active_widget_id: None,
    };

    let dto = WorkspaceSessionSummaryDto::from(summary);

    assert_eq!(
        dto,
        WorkspaceSessionSummaryDto {
            id: "wss_1".to_owned(),
            workspace_id: "ws_1".to_owned(),
            status: "open".to_owned(),
            active_widget_id: None,
        }
    );
}

#[test]
fn maps_workspace_workbench_state_to_dto() {
    let state = WorkspaceWorkbenchState {
        workspace: WorkspaceSummary {
            id: "ws_1".to_owned(),
            title: "Incident".to_owned(),
            description: None,
            status: "active".to_owned(),
            workbench_id: Some("wb_1".to_owned()),
        },
        workbench: Some(WorkbenchSummary {
            id: "wb_1".to_owned(),
            workspace_id: "ws_1".to_owned(),
            preset_origin_id: None,
        }),
        widget_instances: vec![WidgetInstanceSummary {
            id: "widget-1".to_owned(),
            definition_id: "notes".to_owned(),
            title: "Notes".to_owned(),
            category: "notes".to_owned(),
            layout_mode: "docked".to_owned(),
            dock_x: Some(12),
            dock_y: Some(24),
            dock_width: Some(480),
            dock_height: Some(320),
            popout_x: Some(120),
            popout_y: Some(140),
            popout_width: Some(640),
            popout_height: Some(480),
            always_on_top: true,
            is_visible: true,
            config: Some("{\"scope\":\"workspace\"}".to_owned()),
            state: Some("{\"dirty\":false}".to_owned()),
        }],
        shared_state_objects: vec![SharedStateObjectSummary {
            id: "shared-1".to_owned(),
            key: "current_goal".to_owned(),
            value: "Investigate".to_owned(),
            value_kind: "text".to_owned(),
        }],
        recent_events: vec![WorkbenchEventSummary {
            id: "event-1".to_owned(),
            kind: "workspace_created".to_owned(),
            summary: "Workspace created".to_owned(),
            created_at: "1".to_owned(),
        }],
    };

    let dto = WorkspaceWorkbenchStateDto::from(state);

    assert_eq!(dto.workspace.id, "ws_1");
    assert_eq!(
        dto.workbench
            .as_ref()
            .map(|workbench| workbench.id.as_str()),
        Some("wb_1")
    );
    assert_eq!(dto.widget_instances[0].definition_id, "notes");
    assert_eq!(dto.widget_instances[0].dock_x, Some(12));
    assert_eq!(dto.widget_instances[0].dock_y, Some(24));
    assert_eq!(dto.widget_instances[0].dock_width, Some(480));
    assert_eq!(dto.widget_instances[0].dock_height, Some(320));
    assert_eq!(dto.widget_instances[0].popout_x, Some(120));
    assert_eq!(dto.widget_instances[0].popout_y, Some(140));
    assert_eq!(dto.widget_instances[0].popout_width, Some(640));
    assert_eq!(dto.widget_instances[0].popout_height, Some(480));
    assert!(dto.widget_instances[0].always_on_top);
    assert_eq!(
        dto.widget_instances[0].config.as_deref(),
        Some("{\"scope\":\"workspace\"}")
    );
    assert_eq!(
        dto.widget_instances[0].state.as_deref(),
        Some("{\"dirty\":false}")
    );
    assert_eq!(dto.shared_state_objects[0].key, "current_goal");
    assert_eq!(dto.recent_events[0].kind, "workspace_created");
}

#[test]
fn maps_widget_log_to_dto() {
    let summary = WidgetLogSummary {
        id: "log-1".to_owned(),
        widget_instance_id: "widget-1".to_owned(),
        run_id: Some("run-1".to_owned()),
        level: "info".to_owned(),
        message: "Saved note".to_owned(),
        payload: Some("{\"source\":\"test\"}".to_owned()),
        created_at: "1".to_owned(),
    };

    let dto = WidgetLogDto::from(summary);

    assert_eq!(
        dto,
        WidgetLogDto {
            id: "log-1".to_owned(),
            widget_instance_id: "widget-1".to_owned(),
            run_id: Some("run-1".to_owned()),
            level: "info".to_owned(),
            message: "Saved note".to_owned(),
            payload: Some("{\"source\":\"test\"}".to_owned()),
            created_at: "1".to_owned(),
        }
    );
}

#[test]
fn maps_git_repository_status_to_dto() {
    let summary = GitRepositoryStatusSummary {
        branch: Some(GitBranchStatusSummary {
            name: Some("main".to_owned()),
            upstream: Some("origin/main".to_owned()),
            ahead: Some(1),
            behind: Some(2),
            is_detached: false,
        }),
        working_tree: GitWorkingTreeStatusSummary {
            is_clean: false,
            is_dirty: true,
            staged_count: 1,
            unstaged_count: 1,
            untracked_count: 1,
        },
        changed_files: vec![GitFileChangeSummary {
            area: "staged".to_owned(),
            kind: "modified".to_owned(),
            path: "src/lib.rs".to_owned(),
            original_path: None,
        }],
        last_commit: Some(GitLastCommitSummary {
            hash: "abc123".to_owned(),
            title: "Initial commit".to_owned(),
            author: Some("Hobit".to_owned()),
            committed_at: Some("2026-05-10T00:00:00Z".to_owned()),
        }),
        warnings: vec!["review warning".to_owned()],
    };

    let dto = GitRepositoryStatusDto::from(summary);

    assert_eq!(
        dto.branch
            .as_ref()
            .and_then(|branch| branch.name.as_deref()),
        Some("main")
    );
    assert_eq!(
        dto.branch
            .as_ref()
            .and_then(|branch| branch.upstream.as_deref()),
        Some("origin/main")
    );
    assert_eq!(dto.branch.as_ref().and_then(|branch| branch.ahead), Some(1));
    assert_eq!(
        dto.branch.as_ref().and_then(|branch| branch.behind),
        Some(2)
    );
    assert!(dto.working_tree.is_dirty);
    assert!(!dto.working_tree.is_clean);
    assert_eq!(dto.working_tree.staged_count, 1);
    assert_eq!(dto.changed_files[0].area, "staged");
    assert_eq!(dto.changed_files[0].kind, "modified");
    assert_eq!(dto.changed_files[0].path, "src/lib.rs");
    assert_eq!(
        dto.last_commit
            .as_ref()
            .map(|last_commit| last_commit.hash.as_str()),
        Some("abc123")
    );
    assert_eq!(dto.warnings, vec!["review warning".to_owned()]);
}

#[test]
fn maps_terminal_command_request_to_app_input() {
    let request = RunTerminalCommandRequest {
        workspace_id: "ws_1".to_owned(),
        workbench_id: "wb_1".to_owned(),
        widget_instance_id: "wid_1".to_owned(),
        program: "program".to_owned(),
        args: vec!["--flag".to_owned()],
        working_directory: "C:/work".to_owned(),
        timeout_ms: Some(10),
        stdout_cap_bytes: Some(11),
        stderr_cap_bytes: Some(12),
    };

    let input = RunTerminalCommandInput::from(request);

    assert_eq!(input.workspace_id, "ws_1");
    assert_eq!(input.workbench_id, "wb_1");
    assert_eq!(input.widget_instance_id, "wid_1");
    assert_eq!(input.program, "program");
    assert_eq!(input.args, vec!["--flag"]);
    assert_eq!(input.working_directory, PathBuf::from("C:/work"));
    assert_eq!(input.timeout_ms, Some(10));
    assert_eq!(input.stdout_cap_bytes, Some(11));
    assert_eq!(input.stderr_cap_bytes, Some(12));
}

#[test]
fn maps_terminal_command_response_to_dto() {
    let summary = TerminalCommandRunSummary {
        run_id: "run_1".to_owned(),
        status: "completed".to_owned(),
        exit_code: Some(0),
        stdout: "out".to_owned(),
        stderr: "err".to_owned(),
        stdout_truncated: false,
        stderr_truncated: true,
        duration_ms: 7,
        error_message: None,
    };

    let dto = RunTerminalCommandResponseDto::from(summary);

    assert_eq!(dto.run_id, "run_1");
    assert_eq!(dto.status, "completed");
    assert_eq!(dto.exit_code, Some(0));
    assert_eq!(dto.stdout, "out");
    assert_eq!(dto.stderr, "err");
    assert!(!dto.stdout_truncated);
    assert!(dto.stderr_truncated);
    assert_eq!(dto.duration_ms, 7);
    assert_eq!(dto.error_message, None);
}

#[test]
fn maps_agent_chat_proposal_request_to_app_input() {
    let request = PersistAgentChatProposalRequest {
        workspace_id: "ws_1".to_owned(),
        workbench_id: "wb_1".to_owned(),
        widget_instance_id: "wid_1".to_owned(),
        operator_prompt: "Plan".to_owned(),
        approved_context_snapshot_json: "{\"status\":\"none\"}".to_owned(),
        proposal: AgentChatProposalRequest {
            id: "proposal-1".to_owned(),
            request_summary: "Request summary".to_owned(),
            proposed_plan: vec!["Step".to_owned()],
            context_needed: vec!["None".to_owned()],
            action_proposals: vec![AgentChatProposalActionRequest {
                title: "No tool action executed".to_owned(),
                description: "No tool was executed.".to_owned(),
            }],
            safety_notes: vec!["Proposal only.".to_owned()],
            runtime_notes: vec!["No LLM connected.".to_owned()],
        },
    };

    let input = PersistAgentChatProposalInput::from(request);

    assert_eq!(input.workspace_id, "ws_1");
    assert_eq!(input.workbench_id, "wb_1");
    assert_eq!(input.widget_instance_id, "wid_1");
    assert_eq!(input.operator_prompt, "Plan");
    assert_eq!(
        input.approved_context_snapshot_json,
        "{\"status\":\"none\"}"
    );
    assert_eq!(input.proposal.id, "proposal-1");
    assert_eq!(input.proposal.proposed_plan, vec!["Step"]);
    assert_eq!(input.proposal.context_needed, vec!["None"]);
    assert_eq!(
        input.proposal.action_proposals[0].title,
        "No tool action executed"
    );
}

#[test]
fn maps_agent_chat_proposal_response_to_dto() {
    let summary = AgentChatProposalRunSummary {
        run_id: "run_1".to_owned(),
        status: "completed".to_owned(),
        result_id: "result_1".to_owned(),
        result_type: "agent_chat_mock_proposal_result".to_owned(),
        summary: "Agent Chat proposal-only mock result persisted".to_owned(),
    };

    let dto = PersistAgentChatProposalResponseDto::from(summary);

    assert_eq!(dto.run_id, "run_1");
    assert_eq!(dto.status, "completed");
    assert_eq!(dto.result_id, "result_1");
    assert_eq!(dto.result_type, "agent_chat_mock_proposal_result");
    assert_eq!(
        dto.summary,
        "Agent Chat proposal-only mock result persisted"
    );
}

#[test]
fn maps_agent_monitoring_snapshot_to_dto() {
    let summary = AgentMonitoringSnapshot {
        workspace_id: "ws_1".to_owned(),
        workbench_id: "wb_1".to_owned(),
        proposal_results: vec![AgentMonitoringProposalResultSummary {
            run_id: "run_1".to_owned(),
            result_id: "result_1".to_owned(),
            status: "completed".to_owned(),
            result_type: "agent_chat_mock_proposal_result".to_owned(),
            result_summary: Some("Summary".to_owned()),
            result_content: Some("Content".to_owned()),
            run_started_at: "1".to_owned(),
            run_finished_at: Some("2".to_owned()),
            result_created_at: "3".to_owned(),
            source_widget_id: "wid_1".to_owned(),
            source_widget_title: "Agent Chat".to_owned(),
            runtime_status: "proposal_only_mock".to_owned(),
            provider_status: "local_mock".to_owned(),
            provider_used: false,
            provider_response_received: false,
            no_llm_called: true,
            no_tools_executed: true,
            no_mutations_performed: true,
            context_was_approved: true,
            operator_prompt: "Plan".to_owned(),
            proposal_summary: "Proposal summary".to_owned(),
            proposed_plan: vec!["Step".to_owned()],
            context_needed: vec!["None".to_owned()],
            approved_context_summary: "Prompt only".to_owned(),
            approved_context_status: "none".to_owned(),
            approved_context_source_labels: vec!["Workspace identity".to_owned()],
            proposed_actions: vec![AgentMonitoringProposalActionSummary {
                title: "No tool action executed".to_owned(),
                description: "No tool was executed.".to_owned(),
                status: "not_executed".to_owned(),
                executed: false,
            }],
            safety_notes: vec!["Proposal only.".to_owned()],
            raw_payload: "{\"runtime_status\":\"proposal_only_mock\"}".to_owned(),
        }],
    };

    let dto = AgentMonitoringSnapshotDto::from(summary);

    assert_eq!(dto.workspace_id, "ws_1");
    assert_eq!(dto.workbench_id, "wb_1");
    assert_eq!(dto.proposal_results.len(), 1);
    assert_eq!(dto.proposal_results[0].run_id, "run_1");
    assert_eq!(dto.proposal_results[0].source_widget_title, "Agent Chat");
    assert_eq!(dto.proposal_results[0].operator_prompt, "Plan");
    assert_eq!(dto.proposal_results[0].provider_status, "local_mock");
    assert!(!dto.proposal_results[0].provider_used);
    assert!(dto.proposal_results[0].context_was_approved);
    assert_eq!(dto.proposal_results[0].proposed_plan, vec!["Step"]);
    assert_eq!(
        dto.proposal_results[0].proposed_actions[0].status,
        "not_executed"
    );
    assert!(!dto.proposal_results[0].proposed_actions[0].executed);
}

#[test]
fn accepts_agent_monitoring_snapshot_request_shape() {
    let request = GetAgentMonitoringSnapshotRequest {
        workspace_id: "ws_1".to_owned(),
        workbench_id: "wb_1".to_owned(),
    };

    assert_eq!(request.workspace_id, "ws_1");
    assert_eq!(request.workbench_id, "wb_1");
}
