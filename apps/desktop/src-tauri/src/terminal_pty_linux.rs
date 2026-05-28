use std::ffi::CString;
use std::fs::File;
use std::io::{Read, Write};
use std::os::fd::{AsRawFd, FromRawFd};
use std::os::unix::ffi::OsStrExt;
use std::os::unix::fs::PermissionsExt;
use std::path::Path;
use std::thread;

use crate::terminal_pty::{SharedOutputBuffer, TerminalPtySize};

const TERMINAL_READ_BUFFER_BYTES: usize = 4096;

pub(crate) struct TerminalPtyPlatformSession {
    child_pid: libc::pid_t,
    master: Option<File>,
    input_writer: Option<File>,
    output_reader: Option<thread::JoinHandle<()>>,
    exit_code: Option<i32>,
}

impl TerminalPtyPlatformSession {
    pub(crate) fn start(
        shell: &str,
        shell_args: &[String],
        working_directory: &Path,
        size: TerminalPtySize,
        output: SharedOutputBuffer,
    ) -> Result<Self, String> {
        validate_shell_executable(shell)?;

        let shell_c = c_string(shell, "terminal PTY shell")?;
        let shell_arg_c = shell_args
            .iter()
            .map(|arg| c_string(arg, "terminal PTY shell argument"))
            .collect::<Result<Vec<_>, _>>()?;
        let working_directory_c = c_string_bytes(
            working_directory.as_os_str().as_bytes(),
            "terminal PTY working directory",
        )?;

        let mut argv = Vec::with_capacity(shell_arg_c.len() + 2);
        argv.push(shell_c.as_ptr());
        argv.extend(shell_arg_c.iter().map(|arg| arg.as_ptr()));
        argv.push(std::ptr::null());

        let mut master_fd: libc::c_int = -1;
        let mut winsize = winsize(size);
        let pid = unsafe {
            libc::forkpty(
                &mut master_fd,
                std::ptr::null_mut(),
                std::ptr::null(),
                &mut winsize,
            )
        };

        if pid < 0 {
            return Err(format!(
                "could not create Linux terminal PTY: {}",
                std::io::Error::last_os_error()
            ));
        }

        if pid == 0 {
            unsafe {
                if libc::chdir(working_directory_c.as_ptr()) != 0 {
                    libc::_exit(126);
                }
                libc::execvp(shell_c.as_ptr(), argv.as_ptr());
                libc::_exit(127);
            }
        }

        let master = unsafe { File::from_raw_fd(master_fd) };
        let input_writer = master
            .try_clone()
            .map_err(|error| format!("could not clone Linux PTY input handle: {error}"))?;
        let output_reader_file = master
            .try_clone()
            .map_err(|error| format!("could not clone Linux PTY output handle: {error}"))?;
        let output_reader = thread::spawn(move || read_output_loop(output_reader_file, output));

        Ok(Self {
            child_pid: pid,
            master: Some(master),
            input_writer: Some(input_writer),
            output_reader: Some(output_reader),
            exit_code: None,
        })
    }

    pub(crate) fn write_stdin(&mut self, bytes: &[u8]) -> Result<(), String> {
        let Some(writer) = self.input_writer.as_mut() else {
            return Err("terminal PTY input is closed".to_owned());
        };

        writer
            .write_all(bytes)
            .map_err(|error| format!("could not write terminal PTY stdin: {error}"))?;
        writer
            .flush()
            .map_err(|error| format!("could not flush terminal PTY stdin: {error}"))
    }

    pub(crate) fn resize(&mut self, size: TerminalPtySize) -> Result<(), String> {
        let Some(master) = self.master.as_ref() else {
            return Err("terminal PTY master is closed".to_owned());
        };

        let mut winsize = winsize(size);
        let result = unsafe {
            libc::ioctl(
                master.as_raw_fd(),
                libc::TIOCSWINSZ,
                &mut winsize as *mut libc::winsize,
            )
        };
        if result != 0 {
            return Err(format!(
                "could not resize Linux terminal PTY: {}",
                std::io::Error::last_os_error()
            ));
        }

        Ok(())
    }

    pub(crate) fn kill(&mut self) -> Result<(), String> {
        if self.exit_code.is_some() {
            return Ok(());
        }

        let killed = unsafe { libc::kill(self.child_pid, libc::SIGKILL) };
        if killed != 0 {
            let error = std::io::Error::last_os_error();
            if error.raw_os_error() != Some(libc::ESRCH) {
                return Err(format!(
                    "could not force terminate Linux terminal PTY process: {error}"
                ));
            }
        }

        let mut status = 0;
        let waited = unsafe { libc::waitpid(self.child_pid, &mut status, 0) };
        if waited == self.child_pid {
            self.exit_code = Some(wait_status_to_exit_code(status));
        }
        Ok(())
    }

    pub(crate) fn try_exit_code(&mut self) -> Result<Option<i32>, String> {
        if self.exit_code.is_some() {
            return Ok(self.exit_code);
        }

        let mut status = 0;
        let waited = unsafe { libc::waitpid(self.child_pid, &mut status, libc::WNOHANG) };
        if waited == 0 {
            return Ok(None);
        }
        if waited == self.child_pid {
            let exit_code = wait_status_to_exit_code(status);
            self.exit_code = Some(exit_code);
            return Ok(Some(exit_code));
        }

        let error = std::io::Error::last_os_error();
        if error.raw_os_error() == Some(libc::ECHILD) {
            return Ok(self.exit_code);
        }

        Err(format!(
            "could not inspect Linux terminal PTY process state: {error}"
        ))
    }

    pub(crate) fn close_runtime_resources(&mut self) {
        self.input_writer.take();
        self.master.take();
        if let Some(output_reader) = self.output_reader.take() {
            let _ = output_reader.join();
        }
    }
}

impl Drop for TerminalPtyPlatformSession {
    fn drop(&mut self) {
        self.close_runtime_resources();
    }
}

fn read_output_loop(mut output_reader: File, output: SharedOutputBuffer) {
    let mut buffer = [0_u8; TERMINAL_READ_BUFFER_BYTES];
    loop {
        match output_reader.read(&mut buffer) {
            Ok(0) => break,
            Ok(read_count) => output.push_terminal_output(&buffer[..read_count]),
            Err(error) => {
                if error.raw_os_error() != Some(libc::EIO) {
                    output.push_terminal_output(
                        format!("[hobit terminal PTY output read error: {error}]").as_bytes(),
                    );
                }
                break;
            }
        }
    }
}

fn winsize(size: TerminalPtySize) -> libc::winsize {
    libc::winsize {
        ws_row: size.rows,
        ws_col: size.cols,
        ws_xpixel: 0,
        ws_ypixel: 0,
    }
}

fn wait_status_to_exit_code(status: libc::c_int) -> i32 {
    if libc::WIFEXITED(status) {
        return libc::WEXITSTATUS(status);
    }
    if libc::WIFSIGNALED(status) {
        return 128 + libc::WTERMSIG(status);
    }
    status
}

fn validate_shell_executable(shell: &str) -> Result<(), String> {
    if shell.contains('/') {
        return validate_executable_path(Path::new(shell), shell);
    }

    let Some(path_env) = std::env::var_os("PATH") else {
        return Err(format!(
            "terminal PTY shell executable was not found on PATH: {shell}"
        ));
    };

    for path in std::env::split_paths(&path_env) {
        let candidate = path.join(shell);
        if is_executable_file(&candidate) {
            return Ok(());
        }
    }

    Err(format!(
        "terminal PTY shell executable was not found on PATH: {shell}"
    ))
}

fn validate_executable_path(path: &Path, shell: &str) -> Result<(), String> {
    if is_executable_file(path) {
        return Ok(());
    }

    Err(format!(
        "terminal PTY shell executable is not executable or does not exist: {shell}"
    ))
}

fn is_executable_file(path: &Path) -> bool {
    let Ok(metadata) = std::fs::metadata(path) else {
        return false;
    };
    metadata.is_file() && metadata.permissions().mode() & 0o111 != 0
}

fn c_string(value: &str, label: &str) -> Result<CString, String> {
    CString::new(value).map_err(|_| format!("{label} must not contain NUL bytes"))
}

fn c_string_bytes(value: &[u8], label: &str) -> Result<CString, String> {
    CString::new(value).map_err(|_| format!("{label} must not contain NUL bytes"))
}
