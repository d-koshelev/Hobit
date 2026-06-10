use std::path::{Path, PathBuf};
use std::time::Instant;

use hobit_tools::process::{
    run_process_once, ProcessRunOutput, ProcessRunRequest, ProcessRunStatus,
    DEFAULT_PROCESS_TIMEOUT_MS, DEFAULT_STDERR_CAP_BYTES, DEFAULT_STDOUT_CAP_BYTES,
};

use crate::WorkspaceServiceError;

use super::{
    agent_queue_tasks::{load_agent_queue_task, map_storage_agent_queue_task_error},
    placeholder_id,
    validation::required_input,
    AgentQueueValidationCommandEvidenceSummary, AgentQueueValidationCommandRunSummary,
    AgentQueueValidationCommandSpecInput, AgentQueueValidationSuiteRunSummary,
    RunAgentQueueValidationSuiteInput, WorkspaceService,
};

const VALIDATION_STATUS_PASSED: &str = "passed";
const VALIDATION_STATUS_FAILED: &str = "failed";
const VALIDATION_STATUS_FAILED_TO_START: &str = "failed_to_start";
const VALIDATION_STATUS_TIMED_OUT: &str = "timed_out";
const VALIDATION_STATUS_NEEDS_REVIEW: &str = "needs_review";
const AI_CONTEXT_NOT_APPROVED: &str = "not_approved";

impl WorkspaceService {
    pub fn run_agent_queue_validation_suite(
        &self,
        input: RunAgentQueueValidationSuiteInput,
    ) -> Result<AgentQueueValidationSuiteRunSummary, WorkspaceServiceError> {
        self.run_agent_queue_validation_suite_with_runner(input, run_process_once)
    }

    pub(super) fn run_agent_queue_validation_suite_with_runner<F>(
        &self,
        input: RunAgentQueueValidationSuiteInput,
        mut runner: F,
    ) -> Result<AgentQueueValidationSuiteRunSummary, WorkspaceServiceError>
    where
        F: FnMut(ProcessRunRequest) -> ProcessRunOutput,
    {
        let started_at = Instant::now();
        let input = self.normalize_agent_queue_validation_input(input)?;
        let validation_run_id = placeholder_id("validation_run_");
        let mut command_results = Vec::new();
        let mut evidence = Vec::new();
        let mut warnings = vec![
            "Validation cancellation is unsupported by this runner adapter.".to_owned(),
            "Validation evidence is returned in this run response; durable Queue evidence storage is not implemented in this slice.".to_owned(),
        ];
        let errors = Vec::new();

        for command in &input.commands {
            let safety = validate_command_safety(command);
            let command_result = if safety.blocked {
                blocked_command_result(command, safety.message)
            } else {
                run_validation_command(command, &mut runner)
            };

            evidence.push(command_evidence(
                &validation_run_id,
                &input,
                command,
                &command_result,
            ));

            let should_stop = input.stop_on_first_failure && !is_command_passed(&command_result);
            command_results.push(command_result);
            if should_stop {
                warnings.push("Validation suite stopped after first failed command.".to_owned());
                break;
            }
        }

        let status = suite_status(&command_results);

        Ok(AgentQueueValidationSuiteRunSummary {
            validation_run_id,
            workspace_id: input.workspace_id,
            queue_item_id: input.queue_item_id,
            requested_by_surface: input.requested_by_surface,
            status: status.to_owned(),
            task_validation_status: status.to_owned(),
            command_results,
            evidence,
            warnings,
            errors,
            duration_ms: started_at.elapsed().as_millis(),
            no_git_mutations: true,
            no_commit_push: true,
        })
    }

    fn normalize_agent_queue_validation_input(
        &self,
        input: RunAgentQueueValidationSuiteInput,
    ) -> Result<NormalizedQueueValidationInput, WorkspaceServiceError> {
        let workspace_id = required_input(&input.workspace_id, "workspace id")?.to_owned();
        let queue_item_id = required_input(&input.queue_item_id, "queue item id")?.to_owned();
        let requested_by_surface =
            required_input(&input.requested_by_surface, "requested by surface")?.to_owned();
        let suite_cwd = normalize_existing_directory(&input.cwd, "validation suite cwd")?;

        let task = self
            .store
            .with_immediate_transaction(|store| {
                load_agent_queue_task(store, &workspace_id, &queue_item_id)
            })
            .map_err(map_storage_agent_queue_task_error)?;

        let execution_workspace = task
            .execution_workspace
            .as_deref()
            .ok_or_else(|| {
                WorkspaceServiceError::InvalidInput(
                    "queue task execution workspace is required before validation".to_owned(),
                )
            })
            .and_then(|path| {
                normalize_existing_directory(Path::new(path), "queue task execution workspace")
            })?;

        if !path_within(&suite_cwd, &execution_workspace) {
            return Err(WorkspaceServiceError::InvalidInput(
                "validation suite cwd must be inside the queue task execution workspace".to_owned(),
            ));
        }

        let mut commands = Vec::new();
        for command in input.commands {
            let normalized = normalize_command(command, &execution_workspace)?;
            commands.push(normalized);
        }

        if commands.is_empty() {
            return Err(WorkspaceServiceError::InvalidInput(
                "validation suite requires at least one command".to_owned(),
            ));
        }

        Ok(NormalizedQueueValidationInput {
            workspace_id,
            queue_item_id,
            requested_by_surface,
            commands,
            stop_on_first_failure: input.stop_on_first_failure,
        })
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedQueueValidationInput {
    workspace_id: String,
    queue_item_id: String,
    requested_by_surface: String,
    commands: Vec<NormalizedValidationCommand>,
    stop_on_first_failure: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedValidationCommand {
    command_id: String,
    title: String,
    program: String,
    args: Vec<String>,
    cwd: PathBuf,
    timeout_ms: u64,
    stdout_cap_bytes: usize,
    stderr_cap_bytes: usize,
    allowed_exit_codes: Vec<i32>,
    safety_category: String,
    source: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct SafetyDecision {
    blocked: bool,
    message: Option<String>,
}

fn normalize_command(
    command: AgentQueueValidationCommandSpecInput,
    execution_workspace: &Path,
) -> Result<NormalizedValidationCommand, WorkspaceServiceError> {
    let cwd = normalize_existing_directory(&command.cwd, "validation command cwd")?;
    if !path_within(&cwd, execution_workspace) {
        return Err(WorkspaceServiceError::InvalidInput(format!(
            "validation command cwd must be inside the queue task execution workspace: {}",
            command.command_id
        )));
    }

    let program = required_input(&command.program, "validation command program")?.to_owned();
    let command_id = required_input(&command.command_id, "validation command id")?.to_owned();
    let title = required_input(&command.title, "validation command title")?.to_owned();
    let safety_category = required_input(
        &command.safety_category,
        "validation command safety category",
    )?
    .to_owned();
    let source = required_input(&command.source, "validation command source")?.to_owned();
    let allowed_exit_codes = if command.allowed_exit_codes.is_empty() {
        vec![0]
    } else {
        command
            .allowed_exit_codes
            .into_iter()
            .filter(|code| (0..=255).contains(code))
            .collect()
    };

    Ok(NormalizedValidationCommand {
        command_id,
        title,
        program,
        args: command.args,
        cwd,
        timeout_ms: command.timeout_ms.unwrap_or(DEFAULT_PROCESS_TIMEOUT_MS),
        stdout_cap_bytes: command.stdout_cap_bytes.unwrap_or(DEFAULT_STDOUT_CAP_BYTES),
        stderr_cap_bytes: command.stderr_cap_bytes.unwrap_or(DEFAULT_STDERR_CAP_BYTES),
        allowed_exit_codes: if allowed_exit_codes.is_empty() {
            vec![0]
        } else {
            allowed_exit_codes
        },
        safety_category,
        source,
    })
}

fn run_validation_command<F>(
    command: &NormalizedValidationCommand,
    runner: &mut F,
) -> AgentQueueValidationCommandRunSummary
where
    F: FnMut(ProcessRunRequest) -> ProcessRunOutput,
{
    let output = runner(ProcessRunRequest {
        program: command.program.clone(),
        args: command.args.clone(),
        stdin: None,
        working_directory: command.cwd.clone(),
        timeout_ms: command.timeout_ms,
        stdout_cap_bytes: command.stdout_cap_bytes,
        stderr_cap_bytes: command.stderr_cap_bytes,
    });
    let status = command_status(command, &output);

    AgentQueueValidationCommandRunSummary {
        command_id: command.command_id.clone(),
        title: command.title.clone(),
        status: status.to_owned(),
        exit_code: output.exit_code,
        allowed_exit_codes: command.allowed_exit_codes.clone(),
        cwd: command.cwd.display().to_string(),
        stdout_preview: output.stdout,
        stderr_preview: output.stderr,
        stdout_truncated: output.stdout_truncated,
        stderr_truncated: output.stderr_truncated,
        duration_ms: output.duration_ms,
        error_message: output.error_message,
        command_summary: command_summary(command),
        warnings: Vec::new(),
        errors: Vec::new(),
    }
}

fn command_status(
    command: &NormalizedValidationCommand,
    output: &ProcessRunOutput,
) -> &'static str {
    match output.status {
        ProcessRunStatus::Completed => {
            if output
                .exit_code
                .map(|code| command.allowed_exit_codes.contains(&code))
                .unwrap_or(false)
            {
                VALIDATION_STATUS_PASSED
            } else {
                VALIDATION_STATUS_FAILED
            }
        }
        ProcessRunStatus::FailedToStart => VALIDATION_STATUS_FAILED_TO_START,
        ProcessRunStatus::TimedOut => VALIDATION_STATUS_TIMED_OUT,
    }
}

fn blocked_command_result(
    command: &NormalizedValidationCommand,
    message: Option<String>,
) -> AgentQueueValidationCommandRunSummary {
    let message = message.unwrap_or_else(|| "validation command was blocked".to_owned());
    AgentQueueValidationCommandRunSummary {
        command_id: command.command_id.clone(),
        title: command.title.clone(),
        status: VALIDATION_STATUS_FAILED_TO_START.to_owned(),
        exit_code: None,
        allowed_exit_codes: command.allowed_exit_codes.clone(),
        cwd: command.cwd.display().to_string(),
        stdout_preview: String::new(),
        stderr_preview: String::new(),
        stdout_truncated: false,
        stderr_truncated: false,
        duration_ms: 0,
        error_message: Some(message.clone()),
        command_summary: command_summary(command),
        warnings: Vec::new(),
        errors: vec![message],
    }
}

fn command_evidence(
    validation_run_id: &str,
    input: &NormalizedQueueValidationInput,
    command: &NormalizedValidationCommand,
    result: &AgentQueueValidationCommandRunSummary,
) -> AgentQueueValidationCommandEvidenceSummary {
    AgentQueueValidationCommandEvidenceSummary {
        evidence_id: placeholder_id("validation_evidence_"),
        validation_run_id: validation_run_id.to_owned(),
        workspace_id: input.workspace_id.clone(),
        queue_item_id: input.queue_item_id.clone(),
        command_id: command.command_id.clone(),
        command_label: command.title.clone(),
        program: command.program.clone(),
        args: command.args.clone(),
        cwd: command.cwd.display().to_string(),
        status: result.status.clone(),
        exit_code: result.exit_code,
        stdout_preview: result.stdout_preview.clone(),
        stderr_preview: result.stderr_preview.clone(),
        stdout_truncated: result.stdout_truncated,
        stderr_truncated: result.stderr_truncated,
        duration_ms: result.duration_ms,
        error_message: result.error_message.clone(),
        command_summary: result.command_summary.clone(),
        source: command.source.clone(),
        no_git_mutations: true,
        no_commit_push: true,
        ai_context_status: AI_CONTEXT_NOT_APPROVED.to_owned(),
    }
}

fn validate_command_safety(command: &NormalizedValidationCommand) -> SafetyDecision {
    match command.safety_category.as_str() {
        "read_only" | "build_or_test" => {}
        "writes_workspace" | "mutates_git" | "destructive" | "unknown" => {
            return SafetyDecision {
                blocked: true,
                message: Some(format!(
                    "validation command safety category is not allowed: {}",
                    command.safety_category
                )),
            }
        }
        value => {
            return SafetyDecision {
                blocked: true,
                message: Some(format!("unsupported validation safety category: {value}")),
            }
        }
    }

    let program = program_basename(&command.program);
    if !is_allowed_validation_program(&program) {
        return SafetyDecision {
            blocked: true,
            message: Some(format!(
                "validation command program is not allowlisted: {program}"
            )),
        };
    }

    if is_suspicious_git_command(&program, &command.args)
        || is_suspicious_npm_command(&program, &command.args)
        || contains_shell_control_token(&command.args)
    {
        return SafetyDecision {
            blocked: true,
            message: Some(
                "validation command looks mutating or shell-like and was blocked".to_owned(),
            ),
        };
    }

    SafetyDecision {
        blocked: false,
        message: None,
    }
}

fn suite_status(commands: &[AgentQueueValidationCommandRunSummary]) -> &'static str {
    if commands
        .iter()
        .any(|command| command.status == VALIDATION_STATUS_NEEDS_REVIEW)
    {
        return VALIDATION_STATUS_NEEDS_REVIEW;
    }

    if commands.iter().all(is_command_passed) {
        VALIDATION_STATUS_PASSED
    } else {
        VALIDATION_STATUS_FAILED
    }
}

fn is_command_passed(command: &AgentQueueValidationCommandRunSummary) -> bool {
    command.status == VALIDATION_STATUS_PASSED
        && command
            .exit_code
            .map(|code| command.allowed_exit_codes.contains(&code))
            .unwrap_or(false)
}

fn command_summary(command: &NormalizedValidationCommand) -> Vec<String> {
    let mut summary = vec![command.program.clone()];
    summary.extend(command.args.clone());
    summary
}

fn normalize_existing_directory(
    path: &Path,
    label: &str,
) -> Result<PathBuf, WorkspaceServiceError> {
    if path.as_os_str().is_empty() {
        return Err(WorkspaceServiceError::InvalidInput(format!(
            "{label} must not be empty"
        )));
    }

    let canonical = path.canonicalize().map_err(|error| {
        WorkspaceServiceError::InvalidInput(format!(
            "{label} must be an existing directory: {} ({error})",
            path.display()
        ))
    })?;

    if !canonical.is_dir() {
        return Err(WorkspaceServiceError::InvalidInput(format!(
            "{label} must be an existing directory: {}",
            path.display()
        )));
    }

    Ok(canonical)
}

fn path_within(path: &Path, root: &Path) -> bool {
    path == root || path.starts_with(root)
}

fn program_basename(program: &str) -> String {
    Path::new(program)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(program)
        .to_ascii_lowercase()
}

fn is_allowed_validation_program(program: &str) -> bool {
    matches!(
        program,
        "cargo"
            | "cargo.exe"
            | "dotnet"
            | "dotnet.exe"
            | "git"
            | "git.exe"
            | "node"
            | "node.exe"
            | "npm"
            | "npm.cmd"
            | "npm.exe"
            | "python"
            | "python.exe"
            | "python3"
            | "python3.exe"
    )
}

fn is_suspicious_git_command(program: &str, args: &[String]) -> bool {
    if program != "git" && program != "git.exe" {
        return false;
    }

    let Some(subcommand) = args
        .iter()
        .find(|arg| !arg.starts_with('-'))
        .map(|arg| arg.to_ascii_lowercase())
    else {
        return true;
    };

    !matches!(
        subcommand.as_str(),
        "diff" | "status" | "log" | "show" | "rev-parse" | "branch"
    )
}

fn is_suspicious_npm_command(program: &str, args: &[String]) -> bool {
    if !matches!(program, "npm" | "npm.cmd" | "npm.exe") {
        return false;
    }

    args.first()
        .map(|arg| {
            matches!(
                arg.to_ascii_lowercase().as_str(),
                "publish" | "version" | "adduser"
            )
        })
        .unwrap_or(false)
}

fn contains_shell_control_token(args: &[String]) -> bool {
    args.iter().any(|arg| {
        matches!(
            arg.as_str(),
            "&&" | "||" | "|" | ";" | ">" | ">>" | "<" | "$(" | "`"
        )
    })
}
