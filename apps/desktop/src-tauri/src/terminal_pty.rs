use std::collections::{HashMap, VecDeque};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

#[cfg(not(windows))]
use crate::terminal_pty_unsupported::TerminalPtyPlatformSession;
#[cfg(windows)]
use crate::terminal_pty_windows::TerminalPtyPlatformSession;

const DEFAULT_COLS: u16 = 80;
const DEFAULT_ROWS: u16 = 24;
const DEFAULT_OUTPUT_BUFFER_CAP_BYTES: usize = 64 * 1024;
const MAX_OUTPUT_BUFFER_CAP_BYTES: usize = 1024 * 1024;
const TERMINAL_STREAM_KIND: &str = "terminal";
const STOP_SEQUENCE: &[u8] = b"exit\r\n";

static NEXT_SESSION_SUFFIX: AtomicU64 = AtomicU64::new(1);

#[derive(Clone, Default)]
pub(crate) struct TerminalPtySessionManager {
    sessions: Arc<Mutex<HashMap<String, TerminalPtySession>>>,
}

impl TerminalPtySessionManager {
    pub(crate) fn create_session(
        &self,
        request: TerminalPtyCreateRequest,
    ) -> Result<TerminalPtySessionSnapshot, String> {
        let request = normalize_create_request(request)?;
        let session_id = next_session_id();
        let output = SharedOutputBuffer::new(request.output_buffer_cap_bytes);
        let runtime = TerminalPtyPlatformSession::start(
            &request.shell,
            &request.shell_args,
            &request.working_directory,
            request.size,
            output.clone(),
        )?;
        let session = TerminalPtySession {
            session_id: session_id.clone(),
            workspace_id: request.workspace_id,
            workbench_id: request.workbench_id,
            widget_instance_id: request.widget_instance_id,
            shell: request.shell,
            shell_args: request.shell_args,
            working_directory: request.working_directory,
            size: request.size,
            status: TerminalPtySessionStatus::Running,
            started_at: timestamp(),
            ended_at: None,
            exit_code: None,
            error_message: None,
            stop_requested: false,
            output,
            runtime: Some(runtime),
        };
        let snapshot = session.snapshot();

        self.sessions
            .lock()
            .expect("terminal PTY session registry lock")
            .insert(session_id, session);

        Ok(snapshot)
    }

    pub(crate) fn write_stdin(
        &self,
        request: TerminalPtyWriteRequest,
    ) -> Result<Option<TerminalPtySessionSnapshot>, String> {
        if request.data.is_empty() {
            return Err("terminal PTY stdin data must not be empty".to_owned());
        }

        self.with_matching_session_mut(&request.scope, |session| {
            session.refresh_status();
            if !session.status.is_active() {
                return Err("terminal PTY session is not running".to_owned());
            }
            let Some(runtime) = session.runtime.as_mut() else {
                return Err("terminal PTY session runtime is closed".to_owned());
            };

            runtime.write_stdin(request.data.as_bytes())?;
            Ok(session.snapshot())
        })
    }

    pub(crate) fn resize_session(
        &self,
        request: TerminalPtyResizeRequest,
    ) -> Result<Option<TerminalPtySessionSnapshot>, String> {
        let size = validate_size(request.cols, request.rows)?;

        self.with_matching_session_mut(&request.scope, |session| {
            session.refresh_status();
            if !session.status.is_active() {
                return Err("terminal PTY session is not running".to_owned());
            }
            let Some(runtime) = session.runtime.as_mut() else {
                return Err("terminal PTY session runtime is closed".to_owned());
            };

            runtime.resize(size)?;
            session.size = size;
            Ok(session.snapshot())
        })
    }

    pub(crate) fn stop_session(
        &self,
        scope: TerminalPtySessionScope,
    ) -> Result<Option<TerminalPtySessionSnapshot>, String> {
        self.with_matching_session_mut(&scope, |session| {
            session.refresh_status();
            if !session.status.is_active() {
                return Ok(session.snapshot());
            }
            let Some(runtime) = session.runtime.as_mut() else {
                return Err("terminal PTY session runtime is closed".to_owned());
            };

            runtime.write_stdin(STOP_SEQUENCE)?;
            session.stop_requested = true;
            session.status = TerminalPtySessionStatus::Stopping;
            Ok(session.snapshot())
        })
    }

    pub(crate) fn kill_session(
        &self,
        scope: TerminalPtySessionScope,
    ) -> Result<Option<TerminalPtySessionSnapshot>, String> {
        self.with_matching_session_mut(&scope, |session| {
            session.refresh_status();
            if session.status.is_active() {
                if let Some(mut runtime) = session.runtime.take() {
                    runtime.kill()?;
                    runtime.close_runtime_resources();
                }
                session.status = TerminalPtySessionStatus::Killed;
                session.ended_at = Some(timestamp());
                session.exit_code = None;
            }

            Ok(session.snapshot())
        })
    }

    pub(crate) fn close_session(
        &self,
        scope: TerminalPtySessionScope,
    ) -> Result<Option<TerminalPtySessionSnapshot>, String> {
        let mut sessions = self
            .sessions
            .lock()
            .expect("terminal PTY session registry lock");
        let Some(session) = sessions.get_mut(&scope.session_id) else {
            return Ok(None);
        };
        if !session.matches_scope(&scope) {
            return Ok(None);
        }

        session.refresh_status();
        if session.status.is_active() {
            return Err(
                "terminal PTY session is still running; stop or kill it before closing".to_owned(),
            );
        }

        let mut session = sessions
            .remove(&scope.session_id)
            .expect("matched terminal PTY session");
        if let Some(mut runtime) = session.runtime.take() {
            runtime.close_runtime_resources();
        }
        session.status = TerminalPtySessionStatus::Closed;
        session.ended_at.get_or_insert_with(timestamp);

        Ok(Some(session.snapshot()))
    }

    pub(crate) fn get_session(
        &self,
        scope: TerminalPtySessionScope,
    ) -> Option<TerminalPtySessionSnapshot> {
        self.with_matching_session_mut(&scope, |session| {
            session.refresh_status();
            Ok(session.snapshot())
        })
        .ok()
        .flatten()
    }

    pub(crate) fn list_sessions(
        &self,
        filter: TerminalPtySessionFilter,
    ) -> Vec<TerminalPtySessionSnapshot> {
        let mut sessions = self
            .sessions
            .lock()
            .expect("terminal PTY session registry lock");

        sessions
            .values_mut()
            .filter_map(|session| {
                session.refresh_status();
                filter.matches(session).then(|| session.snapshot())
            })
            .collect()
    }

    pub(crate) fn has_active_widget_session(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        widget_instance_id: &str,
    ) -> bool {
        self.sessions
            .lock()
            .expect("terminal PTY session registry lock")
            .values_mut()
            .any(|session| {
                session.refresh_status();
                session.workspace_id == workspace_id
                    && session.workbench_id == workbench_id
                    && session.widget_instance_id == widget_instance_id
                    && session.status.is_active()
            })
    }

    pub(crate) fn has_active_workspace_session(&self, workspace_id: &str) -> bool {
        self.sessions
            .lock()
            .expect("terminal PTY session registry lock")
            .values_mut()
            .any(|session| {
                session.refresh_status();
                session.workspace_id == workspace_id && session.status.is_active()
            })
    }

    fn with_matching_session_mut<F>(
        &self,
        scope: &TerminalPtySessionScope,
        action: F,
    ) -> Result<Option<TerminalPtySessionSnapshot>, String>
    where
        F: FnOnce(&mut TerminalPtySession) -> Result<TerminalPtySessionSnapshot, String>,
    {
        let mut sessions = self
            .sessions
            .lock()
            .expect("terminal PTY session registry lock");
        let Some(session) = sessions.get_mut(&scope.session_id) else {
            return Ok(None);
        };
        if !session.matches_scope(scope) {
            return Ok(None);
        }

        action(session).map(Some)
    }
}

pub(crate) struct TerminalPtyCreateRequest {
    pub(crate) workspace_id: String,
    pub(crate) workbench_id: String,
    pub(crate) widget_instance_id: String,
    pub(crate) shell: String,
    pub(crate) shell_args: Vec<String>,
    pub(crate) working_directory: PathBuf,
    pub(crate) cols: Option<u16>,
    pub(crate) rows: Option<u16>,
    pub(crate) output_buffer_cap_bytes: Option<usize>,
}

struct NormalizedTerminalPtyCreateRequest {
    workspace_id: String,
    workbench_id: String,
    widget_instance_id: String,
    shell: String,
    shell_args: Vec<String>,
    working_directory: PathBuf,
    size: TerminalPtySize,
    output_buffer_cap_bytes: usize,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct TerminalPtySessionScope {
    pub(crate) workspace_id: String,
    pub(crate) workbench_id: String,
    pub(crate) widget_instance_id: String,
    pub(crate) session_id: String,
}

pub(crate) struct TerminalPtyWriteRequest {
    pub(crate) scope: TerminalPtySessionScope,
    pub(crate) data: String,
}

pub(crate) struct TerminalPtyResizeRequest {
    pub(crate) scope: TerminalPtySessionScope,
    pub(crate) cols: u16,
    pub(crate) rows: u16,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct TerminalPtySessionFilter {
    pub(crate) workspace_id: String,
    pub(crate) workbench_id: String,
    pub(crate) widget_instance_id: Option<String>,
}

impl TerminalPtySessionFilter {
    fn matches(&self, session: &TerminalPtySession) -> bool {
        session.workspace_id == self.workspace_id
            && session.workbench_id == self.workbench_id
            && self
                .widget_instance_id
                .as_ref()
                .map_or(true, |widget_id| session.widget_instance_id == *widget_id)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct TerminalPtySize {
    pub(crate) cols: u16,
    pub(crate) rows: u16,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct TerminalPtySessionSnapshot {
    pub(crate) session_id: String,
    pub(crate) workspace_id: String,
    pub(crate) workbench_id: String,
    pub(crate) widget_instance_id: String,
    pub(crate) shell: String,
    pub(crate) shell_args: Vec<String>,
    pub(crate) working_directory: String,
    pub(crate) cols: u16,
    pub(crate) rows: u16,
    pub(crate) status: String,
    pub(crate) started_at: String,
    pub(crate) ended_at: Option<String>,
    pub(crate) exit_code: Option<i32>,
    pub(crate) error_message: Option<String>,
    pub(crate) output: TerminalPtyOutputSnapshot,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct TerminalPtyOutputSnapshot {
    pub(crate) chunks: Vec<TerminalPtyOutputChunk>,
    pub(crate) total_buffered_bytes: usize,
    pub(crate) dropped_bytes: usize,
    pub(crate) cap_bytes: usize,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct TerminalPtyOutputChunk {
    pub(crate) sequence: u64,
    pub(crate) stream_kind: String,
    pub(crate) text: String,
    pub(crate) byte_len: usize,
}

struct TerminalPtySession {
    session_id: String,
    workspace_id: String,
    workbench_id: String,
    widget_instance_id: String,
    shell: String,
    shell_args: Vec<String>,
    working_directory: PathBuf,
    size: TerminalPtySize,
    status: TerminalPtySessionStatus,
    started_at: String,
    ended_at: Option<String>,
    exit_code: Option<i32>,
    error_message: Option<String>,
    stop_requested: bool,
    output: SharedOutputBuffer,
    runtime: Option<TerminalPtyPlatformSession>,
}

impl TerminalPtySession {
    fn matches_scope(&self, scope: &TerminalPtySessionScope) -> bool {
        self.workspace_id == scope.workspace_id
            && self.workbench_id == scope.workbench_id
            && self.widget_instance_id == scope.widget_instance_id
    }

    fn refresh_status(&mut self) {
        if !self.status.is_active() {
            return;
        }

        let Some(runtime) = self.runtime.as_mut() else {
            return;
        };
        match runtime.try_exit_code() {
            Ok(Some(exit_code)) => {
                if let Some(mut runtime) = self.runtime.take() {
                    runtime.close_runtime_resources();
                }
                self.exit_code = Some(exit_code);
                self.ended_at = Some(timestamp());
                self.status = if self.stop_requested {
                    TerminalPtySessionStatus::Stopped
                } else {
                    TerminalPtySessionStatus::Exited
                };
            }
            Ok(None) => {}
            Err(error) => {
                self.error_message = Some(error);
            }
        }
    }

    fn snapshot(&self) -> TerminalPtySessionSnapshot {
        TerminalPtySessionSnapshot {
            session_id: self.session_id.clone(),
            workspace_id: self.workspace_id.clone(),
            workbench_id: self.workbench_id.clone(),
            widget_instance_id: self.widget_instance_id.clone(),
            shell: self.shell.clone(),
            shell_args: self.shell_args.clone(),
            working_directory: self.working_directory.display().to_string(),
            cols: self.size.cols,
            rows: self.size.rows,
            status: self.status.as_str().to_owned(),
            started_at: self.started_at.clone(),
            ended_at: self.ended_at.clone(),
            exit_code: self.exit_code,
            error_message: self.error_message.clone(),
            output: self.output.snapshot(),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum TerminalPtySessionStatus {
    Running,
    Stopping,
    Exited,
    Stopped,
    Killed,
    Closed,
}

impl TerminalPtySessionStatus {
    fn as_str(self) -> &'static str {
        match self {
            Self::Running => "running",
            Self::Stopping => "stopping",
            Self::Exited => "exited",
            Self::Stopped => "stopped",
            Self::Killed => "killed",
            Self::Closed => "closed",
        }
    }

    fn is_active(self) -> bool {
        matches!(self, Self::Running | Self::Stopping)
    }
}

#[derive(Clone)]
pub(super) struct SharedOutputBuffer {
    inner: Arc<Mutex<TerminalPtyOutputBuffer>>,
}

impl SharedOutputBuffer {
    fn new(cap_bytes: usize) -> Self {
        Self {
            inner: Arc::new(Mutex::new(TerminalPtyOutputBuffer::new(cap_bytes))),
        }
    }

    pub(super) fn push_terminal_output(&self, bytes: &[u8]) {
        self.inner
            .lock()
            .expect("terminal PTY output buffer lock")
            .push(TERMINAL_STREAM_KIND, bytes);
    }

    fn snapshot(&self) -> TerminalPtyOutputSnapshot {
        self.inner
            .lock()
            .expect("terminal PTY output buffer lock")
            .snapshot()
    }
}

struct TerminalPtyOutputBuffer {
    chunks: VecDeque<TerminalPtyOutputChunk>,
    cap_bytes: usize,
    total_buffered_bytes: usize,
    dropped_bytes: usize,
    next_sequence: u64,
}

impl TerminalPtyOutputBuffer {
    fn new(cap_bytes: usize) -> Self {
        Self {
            chunks: VecDeque::new(),
            cap_bytes,
            total_buffered_bytes: 0,
            dropped_bytes: 0,
            next_sequence: 1,
        }
    }

    fn push(&mut self, stream_kind: &str, bytes: &[u8]) {
        if self.cap_bytes == 0 {
            self.dropped_bytes = self.dropped_bytes.saturating_add(bytes.len());
            return;
        }

        let stored_bytes = if bytes.len() > self.cap_bytes {
            self.dropped_bytes = self
                .dropped_bytes
                .saturating_add(bytes.len().saturating_sub(self.cap_bytes));
            &bytes[bytes.len() - self.cap_bytes..]
        } else {
            bytes
        };
        let chunk = TerminalPtyOutputChunk {
            sequence: self.next_sequence,
            stream_kind: stream_kind.to_owned(),
            text: String::from_utf8_lossy(stored_bytes).into_owned(),
            byte_len: stored_bytes.len(),
        };
        self.next_sequence = self.next_sequence.saturating_add(1);
        self.total_buffered_bytes = self.total_buffered_bytes.saturating_add(chunk.byte_len);
        self.chunks.push_back(chunk);

        while self.total_buffered_bytes > self.cap_bytes {
            let Some(removed) = self.chunks.pop_front() else {
                break;
            };
            self.total_buffered_bytes = self.total_buffered_bytes.saturating_sub(removed.byte_len);
            self.dropped_bytes = self.dropped_bytes.saturating_add(removed.byte_len);
        }
    }

    fn snapshot(&self) -> TerminalPtyOutputSnapshot {
        TerminalPtyOutputSnapshot {
            chunks: self.chunks.iter().cloned().collect(),
            total_buffered_bytes: self.total_buffered_bytes,
            dropped_bytes: self.dropped_bytes,
            cap_bytes: self.cap_bytes,
        }
    }
}

fn normalize_create_request(
    request: TerminalPtyCreateRequest,
) -> Result<NormalizedTerminalPtyCreateRequest, String> {
    let workspace_id = required_string(request.workspace_id, "workspace id")?;
    let workbench_id = required_string(request.workbench_id, "workbench id")?;
    let widget_instance_id = required_string(request.widget_instance_id, "widget instance id")?;
    let shell = required_string(request.shell, "terminal shell")?;
    let working_directory = request.working_directory;
    if working_directory.as_os_str().is_empty() {
        return Err("terminal PTY working directory must not be empty".to_owned());
    }
    if !working_directory.is_dir() {
        return Err(format!(
            "terminal PTY working directory must be an existing directory: {}",
            working_directory.display()
        ));
    }

    let cols = request.cols.unwrap_or(DEFAULT_COLS);
    let rows = request.rows.unwrap_or(DEFAULT_ROWS);

    Ok(NormalizedTerminalPtyCreateRequest {
        workspace_id,
        workbench_id,
        widget_instance_id,
        shell,
        shell_args: request.shell_args,
        working_directory,
        size: validate_size(cols, rows)?,
        output_buffer_cap_bytes: validate_buffer_cap(
            request
                .output_buffer_cap_bytes
                .unwrap_or(DEFAULT_OUTPUT_BUFFER_CAP_BYTES),
        )?,
    })
}

fn validate_buffer_cap(cap_bytes: usize) -> Result<usize, String> {
    if cap_bytes > MAX_OUTPUT_BUFFER_CAP_BYTES {
        return Err(format!(
            "terminal PTY output buffer cap must be no greater than {MAX_OUTPUT_BUFFER_CAP_BYTES}"
        ));
    }

    Ok(cap_bytes)
}

fn validate_size(cols: u16, rows: u16) -> Result<TerminalPtySize, String> {
    if cols == 0 {
        return Err("terminal PTY cols must be greater than zero".to_owned());
    }
    if rows == 0 {
        return Err("terminal PTY rows must be greater than zero".to_owned());
    }

    Ok(TerminalPtySize { cols, rows })
}

fn required_string(value: String, label: &str) -> Result<String, String> {
    let value = value.trim().to_owned();
    if value.is_empty() {
        Err(format!("{label} must not be empty"))
    } else {
        Ok(value)
    }
}

fn next_session_id() -> String {
    let suffix = NEXT_SESSION_SUFFIX.fetch_add(1, Ordering::Relaxed);
    format!("tpty_{}_{}", unix_nanos(), suffix)
}

fn timestamp() -> String {
    match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(duration) => format!("{}.{:09}", duration.as_secs(), duration.subsec_nanos()),
        Err(_) => "0.000000000".to_owned(),
    }
}

fn unix_nanos() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn terminal_pty_output_buffer_is_bounded() {
        let mut buffer = TerminalPtyOutputBuffer::new(8);

        buffer.push(TERMINAL_STREAM_KIND, b"123456");
        buffer.push(TERMINAL_STREAM_KIND, b"abcdef");

        let snapshot = buffer.snapshot();
        assert!(snapshot.total_buffered_bytes <= 8);
        assert_eq!(snapshot.dropped_bytes, 6);
        assert_eq!(
            snapshot
                .chunks
                .iter()
                .map(|chunk| chunk.text.as_str())
                .collect::<Vec<_>>(),
            vec!["abcdef"]
        );
    }

    #[test]
    fn terminal_pty_output_buffer_keeps_suffix_for_large_chunk() {
        let mut buffer = TerminalPtyOutputBuffer::new(4);

        buffer.push(TERMINAL_STREAM_KIND, b"1234567890");

        let snapshot = buffer.snapshot();
        assert_eq!(snapshot.total_buffered_bytes, 4);
        assert_eq!(snapshot.dropped_bytes, 6);
        assert_eq!(snapshot.chunks[0].text, "7890");
    }
}
