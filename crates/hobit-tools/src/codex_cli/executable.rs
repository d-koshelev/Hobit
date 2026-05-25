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
pub(crate) struct CodexLaunchCommand {
    pub program: String,
    pub args: Vec<String>,
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
    let appdata_env = env::var_os("APPDATA");
    resolve_codex_executable_with_env(
        requested_program,
        path_env.as_deref(),
        appdata_env.as_deref(),
    )
}

pub(crate) fn resolve_codex_executable_with_path(
    requested_program: &str,
    path_env: Option<&OsStr>,
) -> Result<CodexExecutableResolution, CodexExecutableResolutionError> {
    resolve_codex_executable_with_env(requested_program, path_env, None)
}

fn resolve_codex_executable_with_env(
    requested_program: &str,
    path_env: Option<&OsStr>,
    appdata_env: Option<&OsStr>,
) -> Result<CodexExecutableResolution, CodexExecutableResolutionError> {
    let requested_program = requested_program.trim().to_owned();

    if requested_program.is_empty() {
        return Err(CodexExecutableResolutionError {
            requested_program,
            candidates_tried: Vec::new(),
            message: "codex executable must not be empty".to_owned(),
        });
    }

    if looks_like_codex_exec_command_string(&requested_program) {
        return Err(CodexExecutableResolutionError {
            requested_program: requested_program.clone(),
            candidates_tried: Vec::new(),
            message: format!(
                "codex executable must be the program only, not `{requested_program}`. Use `codex.cmd` or `codex`; Hobit adds `exec` as a separate argv entry."
            ),
        });
    }

    let mut candidates_tried = Vec::new();
    let mut seen_candidates = HashSet::new();

    for candidate in codex_executable_candidates(&requested_program, appdata_env) {
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

fn codex_executable_candidates(
    requested_program: &str,
    appdata_env: Option<&OsStr>,
) -> Vec<String> {
    if cfg!(windows) && is_default_codex_program_name(requested_program) {
        let mut candidates = vec!["codex.cmd".to_owned()];

        if let Some(candidate) = windows_npm_codex_cmd_candidate(requested_program, appdata_env) {
            candidates.push(candidate);
        }

        candidates.extend([
            "codex.exe".to_owned(),
            "codex.bat".to_owned(),
            "codex".to_owned(),
        ]);
        return candidates;
    }

    let mut candidates = if cfg!(windows) && Path::new(requested_program).extension().is_none() {
        vec![
            requested_program.to_owned(),
            format!("{requested_program}.exe"),
            format!("{requested_program}.cmd"),
            format!("{requested_program}.bat"),
        ]
    } else {
        vec![requested_program.to_owned()]
    };

    if let Some(candidate) = windows_npm_codex_cmd_candidate(requested_program, appdata_env) {
        candidates.push(candidate);
    }

    candidates
}

pub(crate) fn codex_launch_command(
    resolved_program: &str,
    codex_args: Vec<String>,
) -> CodexLaunchCommand {
    if cfg!(windows) && is_windows_command_script(resolved_program) {
        let mut args = vec![
            "/D".to_owned(),
            "/C".to_owned(),
            resolved_program.to_owned(),
        ];
        args.extend(codex_args);
        return CodexLaunchCommand {
            program: "cmd.exe".to_owned(),
            args,
        };
    }

    CodexLaunchCommand {
        program: resolved_program.to_owned(),
        args: codex_args,
    }
}

pub(crate) fn actionable_codex_launch_error(message: &str) -> String {
    if is_windows_bad_exe_format_message(message) {
        return format!(
            "{message}. Could not launch Codex CLI. On Windows, try codex.cmd or check that Codex is installed and available on PATH."
        );
    }

    message.to_owned()
}

fn is_default_codex_program_name(requested_program: &str) -> bool {
    !contains_path_separator(requested_program)
        && Path::new(requested_program).extension().is_none()
        && requested_program.eq_ignore_ascii_case("codex")
}

fn windows_npm_codex_cmd_candidate(
    requested_program: &str,
    appdata_env: Option<&OsStr>,
) -> Option<String> {
    if !cfg!(windows) || contains_path_separator(requested_program) {
        return None;
    }

    let program_name = Path::new(requested_program).file_name()?.to_str()?;
    if !program_name.eq_ignore_ascii_case("codex")
        && !program_name.eq_ignore_ascii_case("codex.cmd")
    {
        return None;
    }

    Some(
        PathBuf::from(appdata_env?)
            .join("npm")
            .join("codex.cmd")
            .to_string_lossy()
            .into_owned(),
    )
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

fn is_windows_command_script(program: &str) -> bool {
    let extension = Path::new(program)
        .extension()
        .and_then(OsStr::to_str)
        .unwrap_or_default();

    extension.eq_ignore_ascii_case("cmd") || extension.eq_ignore_ascii_case("bat")
}

fn looks_like_codex_exec_command_string(requested_program: &str) -> bool {
    let parts = requested_program.split_whitespace().collect::<Vec<_>>();
    if parts.len() < 2 || !parts.iter().any(|part| part.eq_ignore_ascii_case("exec")) {
        return false;
    }

    let first = parts[0].trim_matches('"');
    let first_name = Path::new(first)
        .file_name()
        .and_then(OsStr::to_str)
        .unwrap_or(first);

    matches!(
        first_name.to_ascii_lowercase().as_str(),
        "codex" | "codex.exe" | "codex.cmd" | "codex.bat"
    )
}

fn is_windows_bad_exe_format_message(message: &str) -> bool {
    let lower = message.to_ascii_lowercase();
    lower.contains("os error 193") || lower.contains("not a valid win32 application")
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
        fs::write(directory.join("codex"), "not the default windows helper").unwrap();
        let helper = directory.join("codex.cmd");
        fs::write(&helper, "@echo off\r\necho codex-cli 0.0.0\r\n").unwrap();

        let resolution = resolve_codex_executable_with_path("codex", Some(directory.as_os_str()))
            .expect("resolve codex.cmd from PATH");

        assert_eq!(resolution.requested_program, "codex");
        assert_eq!(resolution.program, helper.to_string_lossy().into_owned());
        assert_eq!(resolution.candidates_tried, vec!["codex.cmd"]);
    }

    #[cfg(windows)]
    #[test]
    fn resolving_windows_codex_requests_check_appdata_npm_fallback() {
        let appdata = temp_directory("windows-appdata");
        let npm_directory = appdata.join("npm");
        fs::create_dir_all(&npm_directory).unwrap();
        let helper = npm_directory.join("codex.cmd");
        fs::write(&helper, "@echo off\r\necho codex-cli 0.0.0\r\n").unwrap();
        let helper_candidate = helper.to_string_lossy().into_owned();

        for (requested_program, expected_candidates) in [
            (
                "codex",
                vec!["codex.cmd".to_owned(), helper_candidate.clone()],
            ),
            (
                "codex.cmd",
                vec!["codex.cmd".to_owned(), helper_candidate.clone()],
            ),
        ] {
            let resolution = resolve_codex_executable_with_env(
                requested_program,
                None,
                Some(appdata.as_os_str()),
            )
            .expect("resolve codex.cmd from APPDATA npm fallback");

            assert_eq!(resolution.requested_program, requested_program);
            assert_eq!(resolution.program, helper_candidate);
            assert_eq!(resolution.candidates_tried, expected_candidates);
        }
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
    fn codex_exec_is_rejected_as_an_executable_string() {
        let error = resolve_codex_executable_with_path("codex exec", None)
            .expect_err("combined executable should be rejected");

        assert_eq!(error.requested_program, "codex exec");
        assert!(error.candidates_tried.is_empty());
        assert!(error.message.contains("program only"));
        assert!(error.message.contains("separate argv entry"));
    }

    #[cfg(windows)]
    #[test]
    fn launch_wraps_windows_cmd_shim_with_cmd_exe_and_keeps_args_separate() {
        let launch = codex_launch_command(
            "C:/Users/Dmitry/AppData/Roaming/npm/codex.cmd",
            vec![
                "exec".to_owned(),
                "--skip-git-repo-check".to_owned(),
                "--json".to_owned(),
            ],
        );

        assert_eq!(launch.program, "cmd.exe");
        assert_eq!(
            launch.args,
            vec![
                "/D".to_owned(),
                "/C".to_owned(),
                "C:/Users/Dmitry/AppData/Roaming/npm/codex.cmd".to_owned(),
                "exec".to_owned(),
                "--skip-git-repo-check".to_owned(),
                "--json".to_owned(),
            ]
        );
        assert!(!launch.args.iter().any(|arg| arg == "codex exec"));
        assert!(arg_index(&launch.args, "exec") < arg_index(&launch.args, "--skip-git-repo-check"));
        assert!(
            arg_index(&launch.args, "--skip-git-repo-check") < arg_index(&launch.args, "--json")
        );
    }

    #[test]
    fn os_error_193_launch_message_is_actionable() {
        let message = actionable_codex_launch_error(
            "could not start codex exec: %1 is not a valid Win32 application. (os error 193)",
        );

        assert!(message.contains("Could not launch Codex CLI"));
        assert!(message.contains("try codex.cmd"));
        assert!(message.contains("available on PATH"));
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

    fn arg_index(args: &[String], arg: &str) -> usize {
        args.iter()
            .position(|item| item == arg)
            .unwrap_or_else(|| panic!("missing arg: {arg}"))
    }
}
