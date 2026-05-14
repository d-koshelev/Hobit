use std::ffi::OsStr;
use std::io::{self, Read};
use std::path::Path;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use super::{GitDiffCommandSummary, GitDiffError};

const GIT_DIFF_TIMEOUT: Duration = Duration::from_secs(5);
const GIT_DIFF_POLL_INTERVAL: Duration = Duration::from_millis(10);

#[derive(Debug)]
pub(super) struct GitCommandOutput {
    pub(super) exit_code: Option<i32>,
    pub(super) exit_success: bool,
    pub(super) stdout: Vec<u8>,
    pub(super) stderr: Vec<u8>,
    pub(super) stdout_truncated: bool,
}

#[derive(Debug, Eq, PartialEq)]
struct CappedRead {
    bytes: Vec<u8>,
    exceeded_cap: bool,
}

pub(super) fn run_git_command<I, S>(
    repo_root: &Path,
    args: I,
    stdout_cap_bytes: usize,
    stderr_cap_bytes: usize,
    command_summary: &mut Vec<GitDiffCommandSummary>,
) -> Result<GitCommandOutput, GitDiffError>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let args = args
        .into_iter()
        .map(|arg| arg.as_ref().to_owned())
        .collect::<Vec<_>>();
    let mut summary_args = vec!["-C".to_owned(), repo_root.display().to_string()];
    summary_args.extend(args.iter().map(|arg| arg.to_string_lossy().to_string()));
    command_summary.push(GitDiffCommandSummary {
        program: "git".to_owned(),
        args: summary_args,
    });

    let mut child = Command::new("git")
        .arg("-C")
        .arg(repo_root)
        .args(&args)
        .env("GIT_OPTIONAL_LOCKS", "0")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(map_process_start_error)?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| GitDiffError::Unknown("could not capture Git stdout".to_owned()))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| GitDiffError::Unknown("could not capture Git stderr".to_owned()))?;
    let stdout_reader = spawn_capped_reader(stdout, stdout_cap_bytes);
    let stderr_reader = spawn_capped_reader(stderr, stderr_cap_bytes);
    let started_at = Instant::now();

    let status = loop {
        if let Some(status) = child.try_wait().map_err(map_io_error)? {
            break status;
        }

        if started_at.elapsed() >= GIT_DIFF_TIMEOUT {
            let _ = child.kill();
            let _ = child.wait();
            let _ = join_capped_reader(stdout_reader);
            let _ = join_capped_reader(stderr_reader);
            return Err(GitDiffError::TimedOut);
        }

        thread::sleep(GIT_DIFF_POLL_INTERVAL);
    };

    let stdout = join_capped_reader(stdout_reader)?;
    let stderr = join_capped_reader(stderr_reader)?;

    Ok(GitCommandOutput {
        exit_code: status.code(),
        exit_success: status.success(),
        stdout: stdout.bytes,
        stderr: stderr.bytes,
        stdout_truncated: stdout.exceeded_cap,
    })
}

fn spawn_capped_reader<R>(reader: R, cap_bytes: usize) -> thread::JoinHandle<io::Result<CappedRead>>
where
    R: Read + Send + 'static,
{
    thread::spawn(move || read_capped(reader, cap_bytes))
}

fn read_capped(mut reader: impl Read, cap_bytes: usize) -> io::Result<CappedRead> {
    let mut bytes = Vec::new();
    let mut exceeded_cap = false;
    let mut buffer = [0_u8; 8192];

    loop {
        let read_count = reader.read(&mut buffer)?;

        if read_count == 0 {
            break;
        }

        let remaining = cap_bytes.saturating_sub(bytes.len());

        if remaining > 0 {
            let stored_count = remaining.min(read_count);
            bytes.extend_from_slice(&buffer[..stored_count]);
        }

        if read_count > remaining {
            exceeded_cap = true;
        }
    }

    Ok(CappedRead {
        bytes,
        exceeded_cap,
    })
}

fn join_capped_reader(
    reader: thread::JoinHandle<io::Result<CappedRead>>,
) -> Result<CappedRead, GitDiffError> {
    reader
        .join()
        .map_err(|_| GitDiffError::Unknown("Git diff output reader failed".to_owned()))?
        .map_err(map_io_error)
}

fn map_process_start_error(error: io::Error) -> GitDiffError {
    match error.kind() {
        io::ErrorKind::NotFound => GitDiffError::GitUnavailable,
        io::ErrorKind::PermissionDenied => GitDiffError::PermissionDenied,
        _ => GitDiffError::Unknown(format!("could not start Git diff command: {error}")),
    }
}

fn map_io_error(error: io::Error) -> GitDiffError {
    match error.kind() {
        io::ErrorKind::PermissionDenied => GitDiffError::PermissionDenied,
        _ => GitDiffError::Unknown(format!("could not read Git diff output: {error}")),
    }
}
