use std::path::PathBuf;

use serde_json::json;

use crate::{
    terminal_pty::{TerminalPtyOutputChunk, TerminalPtyOutputSnapshot, TerminalPtySessionSnapshot},
    terminal_pty_dto::{
        CreateTerminalPtySessionRequest, ResizeTerminalPtySessionRequest, TerminalPtySessionDto,
        WriteTerminalPtySessionRequest,
    },
};

#[test]
fn maps_terminal_pty_create_request_to_runtime_request() {
    let request = CreateTerminalPtySessionRequest {
        workspace_id: "ws_1".to_owned(),
        workbench_id: "wb_1".to_owned(),
        widget_instance_id: "term_1".to_owned(),
        shell: "".to_owned(),
        shell_args: vec!["-NoLogo".to_owned()],
        working_directory: "C:/work".to_owned(),
        cols: Some(100),
        rows: Some(30),
        output_buffer_cap_bytes: Some(65_536),
    };

    let runtime_request: crate::terminal_pty::TerminalPtyCreateRequest = request.into();

    assert_eq!(runtime_request.workspace_id, "ws_1");
    assert_eq!(runtime_request.workbench_id, "wb_1");
    assert_eq!(runtime_request.widget_instance_id, "term_1");
    assert_eq!(runtime_request.shell, "");
    assert_eq!(runtime_request.shell_args, vec!["-NoLogo"]);
    assert_eq!(runtime_request.working_directory, PathBuf::from("C:/work"));
    assert_eq!(runtime_request.cols, Some(100));
    assert_eq!(runtime_request.rows, Some(30));
    assert_eq!(runtime_request.output_buffer_cap_bytes, Some(65_536));
}

#[test]
fn maps_terminal_pty_write_request_with_raw_data_unchanged() {
    let request = WriteTerminalPtySessionRequest {
        workspace_id: "ws_1".to_owned(),
        workbench_id: "wb_1".to_owned(),
        widget_instance_id: "term_1".to_owned(),
        session_id: "pty_1".to_owned(),
        data: "\u{1b}[A\r".to_owned(),
    };

    let runtime_request: crate::terminal_pty::TerminalPtyWriteRequest = request.into();

    assert_eq!(runtime_request.scope.session_id, "pty_1");
    assert_eq!(runtime_request.data, "\u{1b}[A\r");
}

#[test]
fn maps_terminal_pty_resize_request_cols_and_rows() {
    let request = ResizeTerminalPtySessionRequest {
        workspace_id: "ws_1".to_owned(),
        workbench_id: "wb_1".to_owned(),
        widget_instance_id: "term_1".to_owned(),
        session_id: "pty_1".to_owned(),
        cols: 120,
        rows: 40,
    };

    let runtime_request: crate::terminal_pty::TerminalPtyResizeRequest = request.into();

    assert_eq!(runtime_request.scope.workspace_id, "ws_1");
    assert_eq!(runtime_request.cols, 120);
    assert_eq!(runtime_request.rows, 40);
}

#[test]
fn serializes_terminal_pty_session_dto_with_stable_snake_case_output_fields() {
    let dto = TerminalPtySessionDto::from(TerminalPtySessionSnapshot {
        session_id: "pty_1".to_owned(),
        workspace_id: "ws_1".to_owned(),
        workbench_id: "wb_1".to_owned(),
        widget_instance_id: "term_1".to_owned(),
        shell: "pwsh".to_owned(),
        shell_args: vec!["-NoLogo".to_owned()],
        working_directory: "C:/work".to_owned(),
        cols: 100,
        rows: 30,
        status: "running".to_owned(),
        started_at: "1".to_owned(),
        ended_at: None,
        exit_code: None,
        error_message: None,
        output: TerminalPtyOutputSnapshot {
            chunks: vec![TerminalPtyOutputChunk {
                sequence: 1,
                stream_kind: "pty".to_owned(),
                text: "raw\u{1b}[0m".to_owned(),
                byte_len: 7,
            }],
            total_buffered_bytes: 7,
            dropped_bytes: 0,
            cap_bytes: 65_536,
        },
    });

    assert_eq!(
        serde_json::to_value(dto).expect("serialize terminal dto"),
        json!({
            "session_id": "pty_1",
            "workspace_id": "ws_1",
            "workbench_id": "wb_1",
            "widget_instance_id": "term_1",
            "shell": "pwsh",
            "shell_args": ["-NoLogo"],
            "working_directory": "C:/work",
            "cols": 100,
            "rows": 30,
            "status": "running",
            "started_at": "1",
            "ended_at": null,
            "exit_code": null,
            "error_message": null,
            "output": {
                "chunks": [{
                    "sequence": 1,
                    "stream_kind": "pty",
                    "text": "raw\u{1b}[0m",
                    "byte_len": 7
                }],
                "total_buffered_bytes": 7,
                "dropped_bytes": 0,
                "cap_bytes": 65536
            }
        })
    );
}
