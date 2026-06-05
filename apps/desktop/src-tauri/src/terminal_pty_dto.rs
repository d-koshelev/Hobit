use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use crate::terminal_pty::{
    TerminalPtyCreateRequest, TerminalPtyOutputChunk, TerminalPtyOutputSnapshot,
    TerminalPtyResizeRequest, TerminalPtySessionFilter, TerminalPtySessionScope,
    TerminalPtySessionSnapshot, TerminalPtyWriteRequest,
};

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct CreateTerminalPtySessionRequest {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub shell: String,
    pub shell_args: Vec<String>,
    pub working_directory: String,
    pub cols: Option<u16>,
    pub rows: Option<u16>,
    pub output_buffer_cap_bytes: Option<usize>,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct TerminalPtySessionActionRequest {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub session_id: String,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct WriteTerminalPtySessionRequest {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub session_id: String,
    pub data: String,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct ResizeTerminalPtySessionRequest {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub session_id: String,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct ListTerminalPtySessionsRequest {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct TerminalPtySessionDto {
    pub session_id: String,
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub shell: String,
    pub shell_args: Vec<String>,
    pub working_directory: String,
    pub cols: u16,
    pub rows: u16,
    pub status: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub exit_code: Option<i32>,
    pub error_message: Option<String>,
    pub output: TerminalPtyOutputDto,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct TerminalPtyOutputDto {
    pub chunks: Vec<TerminalPtyOutputChunkDto>,
    pub total_buffered_bytes: usize,
    pub dropped_bytes: usize,
    pub cap_bytes: usize,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct TerminalPtyOutputChunkDto {
    pub sequence: u64,
    pub stream_kind: String,
    pub text: String,
    pub byte_len: usize,
}

impl TryFrom<CreateTerminalPtySessionRequest> for TerminalPtyCreateRequest {
    type Error = String;

    fn try_from(request: CreateTerminalPtySessionRequest) -> Result<Self, Self::Error> {
        Ok(Self {
            workspace_id: request.workspace_id,
            workbench_id: request.workbench_id,
            widget_instance_id: request.widget_instance_id,
            shell: request.shell,
            shell_args: request.shell_args,
            working_directory: resolve_terminal_working_directory(request.working_directory)?,
            cols: request.cols,
            rows: request.rows,
            output_buffer_cap_bytes: request.output_buffer_cap_bytes,
        })
    }
}

impl From<TerminalPtySessionActionRequest> for TerminalPtySessionScope {
    fn from(request: TerminalPtySessionActionRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            workbench_id: request.workbench_id,
            widget_instance_id: request.widget_instance_id,
            session_id: request.session_id,
        }
    }
}

impl From<WriteTerminalPtySessionRequest> for TerminalPtyWriteRequest {
    fn from(request: WriteTerminalPtySessionRequest) -> Self {
        Self {
            scope: TerminalPtySessionScope {
                workspace_id: request.workspace_id,
                workbench_id: request.workbench_id,
                widget_instance_id: request.widget_instance_id,
                session_id: request.session_id,
            },
            data: request.data,
        }
    }
}

impl From<ResizeTerminalPtySessionRequest> for TerminalPtyResizeRequest {
    fn from(request: ResizeTerminalPtySessionRequest) -> Self {
        Self {
            scope: TerminalPtySessionScope {
                workspace_id: request.workspace_id,
                workbench_id: request.workbench_id,
                widget_instance_id: request.widget_instance_id,
                session_id: request.session_id,
            },
            cols: request.cols,
            rows: request.rows,
        }
    }
}

impl From<ListTerminalPtySessionsRequest> for TerminalPtySessionFilter {
    fn from(request: ListTerminalPtySessionsRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            workbench_id: request.workbench_id,
            widget_instance_id: request.widget_instance_id,
        }
    }
}

impl From<TerminalPtySessionSnapshot> for TerminalPtySessionDto {
    fn from(snapshot: TerminalPtySessionSnapshot) -> Self {
        Self {
            session_id: snapshot.session_id,
            workspace_id: snapshot.workspace_id,
            workbench_id: snapshot.workbench_id,
            widget_instance_id: snapshot.widget_instance_id,
            shell: snapshot.shell,
            shell_args: snapshot.shell_args,
            working_directory: snapshot.working_directory,
            cols: snapshot.cols,
            rows: snapshot.rows,
            status: snapshot.status,
            started_at: snapshot.started_at,
            ended_at: snapshot.ended_at,
            exit_code: snapshot.exit_code,
            error_message: snapshot.error_message,
            output: TerminalPtyOutputDto::from(snapshot.output),
        }
    }
}

impl From<TerminalPtyOutputSnapshot> for TerminalPtyOutputDto {
    fn from(output: TerminalPtyOutputSnapshot) -> Self {
        Self {
            chunks: output
                .chunks
                .into_iter()
                .map(TerminalPtyOutputChunkDto::from)
                .collect(),
            total_buffered_bytes: output.total_buffered_bytes,
            dropped_bytes: output.dropped_bytes,
            cap_bytes: output.cap_bytes,
        }
    }
}

impl From<TerminalPtyOutputChunk> for TerminalPtyOutputChunkDto {
    fn from(chunk: TerminalPtyOutputChunk) -> Self {
        Self {
            sequence: chunk.sequence,
            stream_kind: chunk.stream_kind,
            text: chunk.text,
            byte_len: chunk.byte_len,
        }
    }
}

fn resolve_terminal_working_directory(value: String) -> Result<PathBuf, String> {
    if !is_home_relative_path(&value) {
        return Ok(PathBuf::from(value));
    }

    let home_directory = terminal_home_directory().ok_or_else(|| {
        "Could not resolve Terminal working directory `~` because the current user's home directory is unavailable.".to_owned()
    })?;
    Ok(resolve_home_relative_path_with_home(
        &value,
        &home_directory,
    ))
}

fn is_home_relative_path(value: &str) -> bool {
    let value = value.trim();
    value == "~" || value.starts_with("~/") || value.starts_with("~\\")
}

fn resolve_home_relative_path_with_home(value: &str, home_directory: &Path) -> PathBuf {
    let value = value.trim();
    if value == "~" {
        return home_directory.to_path_buf();
    }

    let rest = value
        .strip_prefix("~/")
        .or_else(|| value.strip_prefix("~\\"))
        .unwrap_or_default();
    let mut resolved = home_directory.to_path_buf();
    for part in rest.split(['/', '\\']).filter(|part| !part.is_empty()) {
        resolved.push(part);
    }
    resolved
}

#[cfg(windows)]
fn terminal_home_directory() -> Option<PathBuf> {
    std::env::var_os("USERPROFILE")
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .or_else(|| {
            let drive = std::env::var_os("HOMEDRIVE")?;
            let path = std::env::var_os("HOMEPATH")?;
            if drive.is_empty() || path.is_empty() {
                return None;
            }
            let mut home = std::ffi::OsString::from(drive);
            home.push(path);
            Some(PathBuf::from(home))
        })
}

#[cfg(not(windows))]
fn terminal_home_directory() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn terminal_pty_home_relative_working_directory_uses_home_path() {
        let home = PathBuf::from("C:/Users/Dmitry");

        assert_eq!(
            resolve_home_relative_path_with_home("~", &home),
            PathBuf::from("C:/Users/Dmitry")
        );
        assert_eq!(
            resolve_home_relative_path_with_home("~/project/app", &home),
            PathBuf::from("C:/Users/Dmitry/project/app")
        );
        assert_eq!(
            resolve_home_relative_path_with_home("~\\project\\app", &home),
            PathBuf::from("C:/Users/Dmitry/project/app")
        );
    }
}
