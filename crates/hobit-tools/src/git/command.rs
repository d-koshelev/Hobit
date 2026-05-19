use std::io::{self, Read};
use std::path::Path;
use std::process::{Command, ExitStatus, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use super::parsing::parse_git_status_porcelain_v1_branch;
use super::types::{GitRepositoryStatus, GitStatusError};

const GIT_STATUS_TIMEOUT: Duration = Duration::from_secs(5);
const GIT_STATUS_STDOUT_CAP_BYTES: usize = 256 * 1024;
const GIT_STATUS_STDERR_CAP_BYTES: usize = 64 * 1024;
const GIT_STATUS_POLL_INTERVAL: Duration = Duration::from_millis(10);

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct GitStatusCommandLimits {
    timeout: Duration,
    stdout_cap_bytes: usize,
    stderr_cap_bytes: usize,
}

impl Default for GitStatusCommandLimits {
    fn default() -> Self {
        Self {
            timeout: GIT_STATUS_TIMEOUT,
            stdout_cap_bytes: GIT_STATUS_STDOUT_CAP_BYTES,
            stderr_cap_bytes: GIT_STATUS_STDERR_CAP_BYTES,
        }
    }
}

#[derive(Debug)]
struct GitCommandOutput {
    status: ExitStatus,
    stdout: Vec<u8>,
    stderr: Vec<u8>,
}

#[derive(Debug, Eq, PartialEq)]
struct CappedRead {
    bytes: Vec<u8>,
    exceeded_cap: bool,
}

/// Run the fixed read-only Git status command against an explicit repository root.
///
/// This function does not discover repositories, scan parent directories, fetch,
/// mutate Git state, or expose raw command output as its primary contract. The
/// adapter also disables optional Git locks for the status read.
pub fn read_git_repository_status(
    repo_root: impl AsRef<Path>,
) -> Result<GitRepositoryStatus, GitStatusError> {
    read_git_repository_status_with_limits(repo_root.as_ref(), GitStatusCommandLimits::default())
}

fn read_git_repository_status_with_limits(
    repo_root: &Path,
    limits: GitStatusCommandLimits,
) -> Result<GitRepositoryStatus, GitStatusError> {
    ensure_explicit_repo_root(repo_root)?;

    let output = run_git_status_command(repo_root, limits)?;

    if !output.status.success() {
        return Err(classify_git_status_failure(
            output.status.code(),
            &output.stderr,
        ));
    }

    let stdout = String::from_utf8(output.stdout).map_err(|_| GitStatusError::NonUtf8Output)?;

    Ok(parse_git_status_porcelain_v1_branch(&stdout))
}

fn run_git_status_command(
    repo_root: &Path,
    limits: GitStatusCommandLimits,
) -> Result<GitCommandOutput, GitStatusError> {
    let mut child = Command::new("git")
        .args(["status", "--porcelain=v1", "-b"])
        .current_dir(repo_root)
        .env("GIT_OPTIONAL_LOCKS", "0")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(map_process_start_error)?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| GitStatusError::Unknown("could not capture Git stdout".to_owned()))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| GitStatusError::Unknown("could not capture Git stderr".to_owned()))?;

    let stdout_reader = spawn_capped_reader(stdout, limits.stdout_cap_bytes);
    let stderr_reader = spawn_capped_reader(stderr, limits.stderr_cap_bytes);
    let started_at = Instant::now();

    let status = loop {
        if let Some(status) = child.try_wait().map_err(map_io_error)? {
            break status;
        }

        if started_at.elapsed() >= limits.timeout {
            let _ = child.kill();
            let _ = child.wait();
            let _ = join_capped_reader(stdout_reader);
            let _ = join_capped_reader(stderr_reader);
            return Err(GitStatusError::TimedOut);
        }

        thread::sleep(GIT_STATUS_POLL_INTERVAL);
    };

    let stdout = join_capped_reader(stdout_reader)?;
    let stderr = join_capped_reader(stderr_reader)?;

    if stdout.exceeded_cap || stderr.exceeded_cap {
        return Err(GitStatusError::OutputTooLarge);
    }

    Ok(GitCommandOutput {
        status,
        stdout: stdout.bytes,
        stderr: stderr.bytes,
    })
}

fn ensure_explicit_repo_root(repo_root: &Path) -> Result<(), GitStatusError> {
    if repo_root.as_os_str().is_empty() {
        return Err(GitStatusError::RepositoryNotConfigured);
    }

    match repo_root.try_exists() {
        Ok(true) => Ok(()),
        Ok(false) => Err(GitStatusError::PathNotFound),
        Err(error) if error.kind() == io::ErrorKind::PermissionDenied => {
            Err(GitStatusError::PermissionDenied)
        }
        Err(error) => Err(GitStatusError::Unknown(format!(
            "could not inspect repository path: {error}"
        ))),
    }
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
) -> Result<CappedRead, GitStatusError> {
    reader
        .join()
        .map_err(|_| GitStatusError::Unknown("Git status output reader failed".to_owned()))?
        .map_err(map_io_error)
}

fn map_process_start_error(error: io::Error) -> GitStatusError {
    match error.kind() {
        io::ErrorKind::NotFound => GitStatusError::GitUnavailable,
        io::ErrorKind::PermissionDenied => GitStatusError::PermissionDenied,
        _ => GitStatusError::Unknown(format!("could not start Git status command: {error}")),
    }
}

fn map_io_error(error: io::Error) -> GitStatusError {
    match error.kind() {
        io::ErrorKind::PermissionDenied => GitStatusError::PermissionDenied,
        _ => GitStatusError::Unknown(format!("could not read Git status output: {error}")),
    }
}

fn classify_git_status_failure(exit_code: Option<i32>, stderr: &[u8]) -> GitStatusError {
    let stderr = compact_error_message(&String::from_utf8_lossy(stderr));
    let lower_stderr = stderr.to_ascii_lowercase();

    if lower_stderr.contains("not a git repository")
        || lower_stderr.contains("not in a git directory")
    {
        return GitStatusError::NotGitRepository;
    }

    if lower_stderr.contains("permission denied") {
        return GitStatusError::PermissionDenied;
    }

    if lower_stderr.contains("no such file or directory")
        || lower_stderr.contains("cannot change to")
        || lower_stderr.contains("cannot chdir")
    {
        return GitStatusError::PathNotFound;
    }

    GitStatusError::CommandFailed { exit_code, stderr }
}

fn compact_error_message(message: &str) -> String {
    message
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .take(3)
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn empty_repository_root_is_rejected_before_spawn() {
        let result = read_git_repository_status(Path::new(""));

        assert_eq!(result, Err(GitStatusError::RepositoryNotConfigured));
    }

    #[test]
    fn capped_reader_marks_output_that_exceeds_limit() {
        let output = read_capped(Cursor::new(b"abcdef".to_vec()), 3).unwrap();

        assert_eq!(
            output,
            CappedRead {
                bytes: b"abc".to_vec(),
                exceeded_cap: true,
            }
        );
    }

    #[test]
    fn capped_reader_allows_output_at_limit() {
        let output = read_capped(Cursor::new(b"abc".to_vec()), 3).unwrap();

        assert_eq!(
            output,
            CappedRead {
                bytes: b"abc".to_vec(),
                exceeded_cap: false,
            }
        );
    }

    #[test]
    fn classifies_not_git_repository_failure() {
        let error = classify_git_status_failure(
            Some(128),
            b"fatal: not a git repository (or any of the parent directories): .git\n",
        );

        assert_eq!(error, GitStatusError::NotGitRepository);
    }

    #[test]
    fn classifies_permission_denied_failure() {
        let error =
            classify_git_status_failure(Some(128), b"fatal: permission denied reading .git\n");

        assert_eq!(error, GitStatusError::PermissionDenied);
    }

    #[test]
    fn classifies_unknown_command_failure_with_compact_stderr() {
        let error = classify_git_status_failure(
            Some(128),
            b"\nfirst line\nsecond line\nthird line\nfourth line\n",
        );

        assert_eq!(
            error,
            GitStatusError::CommandFailed {
                exit_code: Some(128),
                stderr: "first line second line third line".to_owned(),
            }
        );
    }
}
