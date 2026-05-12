use std::collections::HashSet;
use std::env;
use std::ffi::OsStr;
use std::fmt;
use std::path::{Path, PathBuf};

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct CodexExecutableResolution {
    pub requested_program: String,
    pub program: String,
    pub candidates_tried: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct CodexExecutableResolutionError {
    pub requested_program: String,
    pub candidates_tried: Vec<String>,
    pub message: String,
}

impl fmt::Display for CodexExecutableResolutionError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

pub(crate) fn resolve_codex_executable(
    requested_program: &str,
) -> Result<CodexExecutableResolution, CodexExecutableResolutionError> {
    let path_env = env::var_os("PATH");
    resolve_codex_executable_with_path(requested_program, path_env.as_deref())
}

pub(crate) fn resolve_codex_executable_with_path(
    requested_program: &str,
    path_env: Option<&OsStr>,
) -> Result<CodexExecutableResolution, CodexExecutableResolutionError> {
    let requested_program = requested_program.trim().to_owned();

    if requested_program.is_empty() {
        return Err(CodexExecutableResolutionError {
            requested_program,
            candidates_tried: Vec::new(),
            message: "codex executable must not be empty".to_owned(),
        });
    }

    let mut candidates_tried = Vec::new();
    let mut seen_candidates = HashSet::new();

    for candidate in codex_executable_candidates(&requested_program) {
        if !seen_candidates.insert(candidate.clone()) {
            continue;
        }

        candidates_tried.push(candidate.clone());

        if let Some(program) = resolve_candidate(&candidate, path_env) {
            return Ok(CodexExecutableResolution {
                requested_program,
                program: program.to_string_lossy().into_owned(),
                candidates_tried,
            });
        }
    }

    Err(CodexExecutableResolutionError {
        message: codex_resolution_error_message(&requested_program, &candidates_tried),
        requested_program,
        candidates_tried,
    })
}

fn codex_executable_candidates(requested_program: &str) -> Vec<String> {
    if cfg!(windows) && Path::new(requested_program).extension().is_none() {
        return vec![
            requested_program.to_owned(),
            format!("{requested_program}.exe"),
            format!("{requested_program}.cmd"),
            format!("{requested_program}.bat"),
        ];
    }

    vec![requested_program.to_owned()]
}

fn resolve_candidate(candidate: &str, path_env: Option<&OsStr>) -> Option<PathBuf> {
    let candidate_path = Path::new(candidate);

    if let Some(path) = existing_file(candidate_path) {
        return Some(path);
    }

    if contains_path_separator(candidate) {
        return None;
    }

    if let Some(path_env) = path_env {
        for directory in env::split_paths(path_env) {
            let path = directory.join(candidate);

            if let Some(path) = existing_file(&path) {
                return Some(path);
            }
        }
    }

    None
}

fn existing_file(path: &Path) -> Option<PathBuf> {
    path.is_file().then(|| path.to_path_buf())
}

fn contains_path_separator(candidate: &str) -> bool {
    candidate.contains('/') || candidate.contains('\\')
}

fn codex_resolution_error_message(requested_program: &str, candidates_tried: &[String]) -> String {
    let candidates = if candidates_tried.is_empty() {
        "none".to_owned()
    } else {
        candidates_tried.join(", ")
    };
    let mut message = format!(
        "could not resolve Codex executable `{requested_program}`. Candidates tried: {candidates}. Searched PATH without invoking a shell."
    );

    if cfg!(windows) {
        message.push_str(
            " On Windows, check `where codex`, `where codex.cmd`, or set a full Codex executable path.",
        );
    }

    message
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[cfg(windows)]
    #[test]
    fn resolving_codex_on_windows_path_finds_codex_cmd_helper() {
        let directory = temp_directory("windows-path-cmd");
        fs::create_dir_all(&directory).unwrap();
        let helper = directory.join("codex.cmd");
        fs::write(&helper, "@echo off\r\necho codex-cli 0.0.0\r\n").unwrap();

        let resolution = resolve_codex_executable_with_path("codex", Some(directory.as_os_str()))
            .expect("resolve codex.cmd from PATH");

        assert_eq!(resolution.requested_program, "codex");
        assert_eq!(resolution.program, helper.to_string_lossy().into_owned());
        assert_eq!(
            resolution.candidates_tried,
            vec!["codex", "codex.exe", "codex.cmd"]
        );
    }

    #[test]
    fn resolving_explicit_helper_path_works() {
        let directory = temp_directory("explicit-helper");
        fs::create_dir_all(&directory).unwrap();
        let helper = directory.join(format!("helper{}", env::consts::EXE_SUFFIX));
        fs::write(&helper, "helper").unwrap();

        let resolution = resolve_codex_executable_with_path(&helper.to_string_lossy(), None)
            .expect("resolve explicit helper path");

        assert_eq!(resolution.program, helper.to_string_lossy().into_owned());
        assert_eq!(resolution.candidates_tried.len(), 1);
    }

    #[test]
    fn missing_executable_returns_clear_error_with_candidates() {
        let error = resolve_codex_executable_with_path("codex", None).expect_err("missing codex");

        assert_eq!(error.requested_program, "codex");
        assert!(error.message.contains("could not resolve Codex executable"));
        assert!(error.message.contains("Candidates tried"));
        assert!(error.message.contains("codex"));
    }

    #[test]
    fn empty_executable_is_rejected_clearly() {
        let error = resolve_codex_executable_with_path("  ", None).expect_err("empty");

        assert_eq!(error.requested_program, "");
        assert!(error.candidates_tried.is_empty());
        assert_eq!(error.message, "codex executable must not be empty");
    }

    fn temp_directory(name: &str) -> PathBuf {
        env::temp_dir().join(format!("hobit-codex-executable-{name}-{}", unique_suffix()))
    }

    fn unique_suffix() -> String {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();

        format!("{}-{nanos}", std::process::id())
    }
}
