use crate::terminal_pty::{
    TerminalPtyCreateRequest, TerminalPtyResizeRequest, TerminalPtySessionFilter,
    TerminalPtySessionManager, TerminalPtySessionScope, TerminalPtyWriteRequest,
};

#[cfg(windows)]
use std::thread;
#[cfg(windows)]
use std::time::Duration;
use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn terminal_pty_create_rejects_missing_working_directory() {
    let manager = TerminalPtySessionManager::default();

    let error = manager
        .create_session(TerminalPtyCreateRequest {
            workspace_id: "ws".to_owned(),
            workbench_id: "wb".to_owned(),
            widget_instance_id: "wid".to_owned(),
            shell: "cmd.exe".to_owned(),
            shell_args: vec![
                "/Q".to_owned(),
                "/C".to_owned(),
                "echo 1234567890123456789012345678901234567890".to_owned(),
            ],
            working_directory: missing_test_directory(),
            cols: Some(80),
            rows: Some(24),
            output_buffer_cap_bytes: Some(1024),
        })
        .expect_err("missing working directory should be rejected");

    assert!(error.contains("working directory"));
}

#[test]
fn terminal_pty_rejects_unknown_session_actions() {
    let manager = TerminalPtySessionManager::default();
    let scope = scope("missing-session");

    assert!(manager
        .write_stdin(TerminalPtyWriteRequest {
            scope: scope.clone(),
            data: "exit\r\n".to_owned(),
        })
        .expect("write unknown")
        .is_none());
    assert!(manager
        .resize_session(TerminalPtyResizeRequest {
            scope: scope.clone(),
            cols: 100,
            rows: 30,
        })
        .expect("resize unknown")
        .is_none());
    assert!(manager
        .stop_session(scope.clone())
        .expect("stop unknown")
        .is_none());
    assert!(manager
        .kill_session(scope.clone())
        .expect("kill unknown")
        .is_none());
    assert!(manager
        .close_session(scope)
        .expect("close unknown")
        .is_none());
}

#[cfg(not(windows))]
#[test]
fn terminal_pty_create_reports_unsupported_platform_without_session() {
    let manager = TerminalPtySessionManager::default();

    let error = manager
        .create_session(TerminalPtyCreateRequest {
            workspace_id: "ws".to_owned(),
            workbench_id: "wb".to_owned(),
            widget_instance_id: "wid".to_owned(),
            shell: "sh".to_owned(),
            shell_args: Vec::new(),
            working_directory: std::env::current_dir().expect("current dir"),
            cols: Some(80),
            rows: Some(24),
            output_buffer_cap_bytes: Some(4096),
        })
        .expect_err("unsupported platform should reject PTY creation");

    assert!(error.contains("supported only on Windows desktop"));
    assert!(manager.list_sessions(filter()).is_empty());
}

#[cfg(windows)]
#[test]
fn terminal_pty_rejects_cross_scope_session_actions() {
    let manager = TerminalPtySessionManager::default();
    let session = create_long_lived_session(&manager);
    let cross_scope = TerminalPtySessionScope {
        workspace_id: "other-workspace".to_owned(),
        workbench_id: "wb".to_owned(),
        widget_instance_id: "wid".to_owned(),
        session_id: session.session_id.clone(),
    };

    assert!(manager
        .write_stdin(TerminalPtyWriteRequest {
            scope: cross_scope.clone(),
            data: "test".to_owned(),
        })
        .expect("cross-scope write")
        .is_none());
    assert!(manager
        .kill_session(cross_scope)
        .expect("cross-scope kill")
        .is_none());

    let killed = manager
        .kill_session(session_scope(&session.session_id))
        .expect("kill")
        .expect("known session");
    assert_eq!(killed.status, "killed");
    let closed = manager
        .close_session(session_scope(&session.session_id))
        .expect("close")
        .expect("closed session");
    assert_eq!(closed.status, "closed");
}

#[cfg(windows)]
#[test]
fn terminal_pty_resize_write_kill_and_close_lifecycle() {
    let manager = TerminalPtySessionManager::default();
    let session = create_long_lived_session(&manager);

    let resized = manager
        .resize_session(TerminalPtyResizeRequest {
            scope: session_scope(&session.session_id),
            cols: 100,
            rows: 30,
        })
        .expect("resize")
        .expect("known session");
    assert_eq!((resized.cols, resized.rows), (100, 30));

    let written = manager
        .write_stdin(TerminalPtyWriteRequest {
            scope: session_scope(&session.session_id),
            data: "\r\n".to_owned(),
        })
        .expect("write")
        .expect("known session");
    assert_eq!(written.status, "running");

    let killed = manager
        .kill_session(session_scope(&session.session_id))
        .expect("kill")
        .expect("known session");
    assert_eq!(killed.status, "killed");
    assert!(!manager.has_active_widget_session("ws", "wb", "wid"));
    assert!(manager.list_sessions(filter()).len() == 1);

    let closed = manager
        .close_session(session_scope(&session.session_id))
        .expect("close")
        .expect("known session");
    assert_eq!(closed.status, "closed");
    assert!(manager.list_sessions(filter()).is_empty());
}

#[cfg(windows)]
#[test]
fn terminal_pty_stop_marks_session_stopping_without_targeting_pid() {
    let manager = TerminalPtySessionManager::default();
    let session = create_long_lived_session(&manager);

    let stopped = manager
        .stop_session(session_scope(&session.session_id))
        .expect("stop")
        .expect("known session");

    assert_eq!(stopped.status, "stopping");
    assert!(manager.has_active_widget_session("ws", "wb", "wid"));

    let _ = manager.kill_session(session_scope(&session.session_id));
    let _ = manager.close_session(session_scope(&session.session_id));
}

#[cfg(windows)]
#[test]
fn timeout_helper_sleeps() {
    thread::sleep(Duration::from_millis(500));
}

#[cfg(windows)]
fn create_long_lived_session(
    manager: &TerminalPtySessionManager,
) -> crate::terminal_pty::TerminalPtySessionSnapshot {
    manager
        .create_session(TerminalPtyCreateRequest {
            workspace_id: "ws".to_owned(),
            workbench_id: "wb".to_owned(),
            widget_instance_id: "wid".to_owned(),
            shell: current_test_exe(),
            shell_args: vec![
                "--exact".to_owned(),
                "terminal_pty_tests::timeout_helper_sleeps".to_owned(),
                "--nocapture".to_owned(),
            ],
            working_directory: std::env::current_dir().expect("current dir"),
            cols: Some(80),
            rows: Some(24),
            output_buffer_cap_bytes: Some(4096),
        })
        .expect("create long-lived terminal PTY session")
}

#[cfg(windows)]
fn session_scope(session_id: &str) -> TerminalPtySessionScope {
    TerminalPtySessionScope {
        workspace_id: "ws".to_owned(),
        workbench_id: "wb".to_owned(),
        widget_instance_id: "wid".to_owned(),
        session_id: session_id.to_owned(),
    }
}

fn scope(session_id: &str) -> TerminalPtySessionScope {
    TerminalPtySessionScope {
        workspace_id: "ws".to_owned(),
        workbench_id: "wb".to_owned(),
        widget_instance_id: "wid".to_owned(),
        session_id: session_id.to_owned(),
    }
}

fn filter() -> TerminalPtySessionFilter {
    TerminalPtySessionFilter {
        workspace_id: "ws".to_owned(),
        workbench_id: "wb".to_owned(),
        widget_instance_id: Some("wid".to_owned()),
    }
}

#[cfg(windows)]
fn current_test_exe() -> String {
    std::env::current_exe()
        .expect("current test exe")
        .to_string_lossy()
        .into_owned()
}

fn missing_test_directory() -> std::path::PathBuf {
    std::env::temp_dir().join(format!("hobit-missing-pty-dir-{}", unique_test_suffix()))
}

fn unique_test_suffix() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();

    format!("{}-{nanos}", std::process::id())
}
