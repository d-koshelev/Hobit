use std::path::Path;

use crate::terminal_pty::{SharedOutputBuffer, TerminalPtySize};

pub(crate) struct TerminalPtyPlatformSession;

impl TerminalPtyPlatformSession {
    pub(crate) fn start(
        _shell: &str,
        _shell_args: &[String],
        _working_directory: &Path,
        _size: TerminalPtySize,
        _output: SharedOutputBuffer,
    ) -> Result<Self, String> {
        Err("Terminal PTY sessions are currently supported only on Windows desktop".to_owned())
    }

    pub(crate) fn write_stdin(&mut self, _bytes: &[u8]) -> Result<(), String> {
        Err("Terminal PTY session is unsupported on this platform".to_owned())
    }

    pub(crate) fn resize(&mut self, _size: TerminalPtySize) -> Result<(), String> {
        Err("Terminal PTY session is unsupported on this platform".to_owned())
    }

    pub(crate) fn kill(&mut self) -> Result<(), String> {
        Err("Terminal PTY session is unsupported on this platform".to_owned())
    }

    pub(crate) fn try_exit_code(&mut self) -> Result<Option<i32>, String> {
        Ok(None)
    }

    pub(crate) fn close_runtime_resources(&mut self) {}
}
