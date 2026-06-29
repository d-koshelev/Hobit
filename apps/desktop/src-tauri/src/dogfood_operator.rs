use std::{
    env, fs,
    path::{Path, PathBuf},
};

use hobit_app::{
    AckAgentQueueReviewMessageInput, AgentQueueCompletionCommandStatus,
    AgentQueuePromptPackFileRequest, AgentQueuePromptPackMaterializeResult,
    AgentQueuePromptPackPreviewResult, AgentQueueReviewCreateMessageStatus,
    AgentQueueWorkerEvidenceQueryState, CodexDirectStreamCancellationToken,
    CreateAgentQueueReviewMessageInput, FinishAssignedAgentQueueTaskRunInput,
    GetAgentQueueWorkerEvidenceBundleInput, MarkAgentQueueItemDoneInput, QueueItemAggregate,
    QueueItemAggregateDependencyState, QueueItemAggregateReviewState,
    QueueItemAggregateTicketState, QueueItemAggregateWorkerRunState,
    QueueLocalProviderReadinessSummary, RecordAgentQueueWorkerFinishedInput,
    SelectedAgentQueueTaskLocalStartSummary, StartSelectedAgentQueueTaskLocalInput,
    WorkspaceService, AGENT_QUEUE_ACCEPTED_COMPLETION_CONFIRMATION_TOKEN,
};
use hobit_storage_sqlite::SqliteStore;
use serde::Serialize;

use crate::database_startup::initialize_database;

pub const DEFAULT_DOGFOOD_PACK_PATH: &str =
    "docs/dogfood/queue-prompt-packs/hobit-queue-dogfood-next.json";
pub const DEFAULT_FIRST_DOGFOOD_TASK_ID: &str = "dogfood-foundation-checkpoint";
const APP_BACKEND_ENDPOINT_UNAVAILABLE: &str =
    "Hobit app/backend operator endpoint is unavailable.";
const WORKER_OUTPUT_TAIL_BYTES: usize = 4000;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DogfoodOperatorRunInput {
    pub database_path: Option<PathBuf>,
    pub app_data_dir: Option<PathBuf>,
    pub workspace_id: Option<String>,
    pub workspace_root: Option<PathBuf>,
    pub pack_path: String,
    pub preview: bool,
    pub materialize: bool,
    pub start_pack_task_id: Option<String>,
    pub allow_worker_start: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DogfoodOperatorAppWorkspaceRunInput {
    pub workspace_id: String,
    pub workspace_resolution_method: String,
    pub workspace_root: Option<String>,
    pub pack_path: String,
    pub preview: bool,
    pub materialize: bool,
    pub start_pack_task_id: Option<String>,
    pub retry_pack_task_id: Option<String>,
    pub allow_worker_start: bool,
    pub endpoint_kind: Option<String>,
    pub endpoint_pid: Option<u32>,
    pub profile_mode: Option<String>,
    pub provider_readiness: Option<QueueLocalProviderReadinessSummary>,
    pub allow_unknown_provider_readiness: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DogfoodOperatorWorkerOutcome {
    pub worker_mode: String,
    pub fake_worker_used: bool,
    pub real_codex_invoked: bool,
    pub completion_status: Option<String>,
    pub terminal_queue_task_status: Option<String>,
    pub worker_exit_code: Option<i32>,
    pub worker_stdout_tail: Option<String>,
    pub worker_stderr_tail: Option<String>,
    pub worker_error_message: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DogfoodOperatorEvidence {
    pub operator_context: DogfoodOperatorContextEvidence,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub database_path: Option<String>,
    pub workspace_id: String,
    pub workspace_resolution: DogfoodWorkspaceResolutionEvidence,
    pub pack_path: String,
    pub preview: Option<DogfoodOperatorPreviewEvidence>,
    pub materialization: Option<DogfoodOperatorMaterializationEvidence>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_readiness: Option<QueueLocalProviderReadinessSummary>,
    pub selected_task: Option<DogfoodOperatorSelectedTaskEvidence>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resume_dogfood: Option<DogfoodOperatorResumeEvidence>,
    pub boundaries: DogfoodOperatorBoundaryEvidence,
    pub real_dogfood_run_performed: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DogfoodOperatorContextEvidence {
    pub context_source: String,
    pub workspace_id: String,
    pub workspace_resolution_method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub database_path: Option<String>,
    pub used_direct_database_path: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub endpoint_kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub endpoint_pid: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace_root: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub app_launch_attempted: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub app_launch_command_summary: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DogfoodWorkspaceResolutionEvidence {
    pub workspace_id: String,
    pub resolution_method: String,
    pub workspace_root: String,
    pub candidate_count: usize,
    pub ambiguity_avoided: bool,
    pub dogfood_binding_reused: bool,
    pub dogfood_workspace_created: bool,
    pub warnings: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DogfoodOperatorPreviewEvidence {
    pub pack_id: String,
    pub pack_spec_hash: String,
    pub run_settings_hash: String,
    pub dependency_spec_hash: String,
    pub full_preview_hash: String,
    pub task_count: usize,
    pub dependency_count: usize,
    pub materialization_status: String,
    pub would_start_workers: bool,
    pub would_create_run_links: bool,
    pub would_mutate_queue: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DogfoodOperatorMaterializationEvidence {
    pub materialization_status: String,
    pub pack_id: Option<String>,
    pub pack_spec_hash: Option<String>,
    pub run_settings_hash: Option<String>,
    pub dependency_spec_hash: Option<String>,
    pub full_preview_hash: Option<String>,
    pub task_count: usize,
    pub created_count: usize,
    pub reused_count: usize,
    pub conflict_count: usize,
    pub mappings: Vec<DogfoodOperatorTaskMappingEvidence>,
    pub dependency_remap: Vec<DogfoodOperatorDependencyRemapEvidence>,
    pub would_start_workers: bool,
    pub would_create_run_links: bool,
    pub would_mutate_queue: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DogfoodOperatorTaskMappingEvidence {
    pub pack_task_id: String,
    pub queue_task_id: Option<String>,
    pub task_spec_hash: String,
    pub status: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DogfoodOperatorDependencyRemapEvidence {
    pub pack_task_id: String,
    pub dependency_queue_task_ids: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DogfoodOperatorSelectedTaskEvidence {
    pub selected_pack_task_id: String,
    pub selected_queue_task_id: String,
    pub run_id: Option<String>,
    pub run_link_id: Option<String>,
    pub launch_status: String,
    pub blocked_reason: Option<String>,
    pub blocker_code: Option<String>,
    pub created_run_link: bool,
    pub created_widget_run: bool,
    pub used_workflow_slot: bool,
    pub used_widget_identity: bool,
    pub would_start_workers: bool,
    pub fake_worker_used: bool,
    pub real_codex_invoked: bool,
    pub completion_status: Option<String>,
    pub terminal_queue_task_status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub worker_exit_code: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub worker_stdout_tail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub worker_stderr_tail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub worker_error_message: Option<String>,
    pub scheduler_autodispatch: bool,
    pub dependent_tasks_auto_started: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DogfoodOperatorBoundaryEvidence {
    pub frontend_materializer_canonical: bool,
    pub queue_lifecycle_frontend_owned: bool,
    pub widget_runs_created: bool,
    pub widget_identity_used: bool,
    pub scheduler_autodispatch_used: bool,
    pub dependent_tasks_auto_started: bool,
    pub automated_tests_launch_real_codex: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DogfoodOperatorResumeEvidence {
    pub status: String,
    pub started_new_worker_count: usize,
    pub selected_pack_task_id: Option<String>,
    pub selected_queue_task_id: Option<String>,
    pub accepted_dependencies: Vec<DogfoodOperatorDependencyFinalizationEvidence>,
    pub task_states_before: Vec<DogfoodOperatorPackTaskStateEvidence>,
    pub task_states_after_finalization: Vec<DogfoodOperatorPackTaskStateEvidence>,
    pub task_states_after_start: Vec<DogfoodOperatorPackTaskStateEvidence>,
    pub dependents_auto_started: bool,
    pub widget_runs_created: bool,
    pub scheduler_autodispatch_used: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DogfoodOperatorDependencyFinalizationEvidence {
    pub pack_task_id: String,
    pub queue_task_id: String,
    pub status: String,
    pub safe_to_finalize: bool,
    pub run_id: Option<String>,
    pub run_link_id: Option<String>,
    pub evidence_bundle_id: Option<String>,
    pub review_message_id: Option<String>,
    pub completion_decision_id: Option<String>,
    pub blocker_code: Option<String>,
    pub blocker_message: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DogfoodOperatorPackTaskStateEvidence {
    pub pack_task_id: String,
    pub queue_task_id: Option<String>,
    pub ticket_state: Option<String>,
    pub worker_run_state: Option<String>,
    pub review_state: Option<String>,
    pub evidence_state: Option<String>,
    pub dependency_state: Option<String>,
    pub latest_run_id: Option<String>,
    pub latest_run_link_id: Option<String>,
    pub latest_run_status: Option<String>,
    pub start_eligible: bool,
    pub finalization_eligible: bool,
}

pub fn run_cli<I, S>(args: I) -> Result<(), String>
where
    I: IntoIterator<Item = S>,
    S: Into<String>,
{
    let options = parse_cli_options(args.into_iter().map(Into::into).collect())?;
    if options.help {
        print_help();
        return Ok(());
    }

    if options.list_workspaces {
        let backend = resolve_operator_backend_context(options.database.as_deref(), None)?;
        print_workspaces(&backend.service)?;
        return Ok(());
    }

    if options.resolve_workspace
        && !options.preview
        && !options.materialize
        && options.start_pack_task_id.is_none()
    {
        let backend = resolve_operator_backend_context(options.database.as_deref(), None)?;
        let resolution = resolve_dogfood_operator_workspace(
            &backend.service,
            options.workspace_id.as_deref(),
            options.workspace_root.as_deref(),
        )?;
        if options.json {
            println!(
                "{}",
                serde_json::to_string_pretty(&resolution).map_err(|error| error.to_string())?
            );
        } else {
            print_workspace_resolution(&resolution);
        }
        return Ok(());
    }

    let input = DogfoodOperatorRunInput {
        database_path: options.database,
        app_data_dir: None,
        workspace_id: options.workspace_id,
        workspace_root: options.workspace_root,
        pack_path: options
            .pack_path
            .unwrap_or_else(|| DEFAULT_DOGFOOD_PACK_PATH.to_owned()),
        preview: options.preview,
        materialize: options.materialize,
        start_pack_task_id: options.start_pack_task_id,
        allow_worker_start: options.allow_real_worker,
    };
    validate_run_input(&input)?;

    let evidence = run_dogfood_operator_with_runner(input, real_worker_runner)?;
    if let Some(report_path) = options.report_path {
        let payload = serde_json::to_string_pretty(&evidence).map_err(|error| error.to_string())?;
        write_report(&report_path, &payload)?;
    }
    if options.json {
        println!(
            "{}",
            serde_json::to_string_pretty(&evidence).map_err(|error| error.to_string())?
        );
    } else {
        print_human_evidence(&evidence);
    }

    Ok(())
}

pub fn run_dogfood_operator_with_runner<F>(
    input: DogfoodOperatorRunInput,
    runner: F,
) -> Result<DogfoodOperatorEvidence, String>
where
    F: FnOnce(
        &WorkspaceService,
        &SelectedAgentQueueTaskLocalStartSummary,
    ) -> Result<DogfoodOperatorWorkerOutcome, String>,
{
    validate_run_input(&input)?;
    let backend = resolve_operator_backend_context(
        input.database_path.as_deref(),
        input.app_data_dir.as_deref(),
    )?;
    let workspace_resolution = resolve_dogfood_operator_workspace(
        &backend.service,
        input.workspace_id.as_deref(),
        input.workspace_root.as_deref(),
    )?;
    let workspace_id = workspace_resolution.workspace_id.clone();
    let request = AgentQueuePromptPackFileRequest {
        workspace_id: workspace_id.clone(),
        workspace_relative_path: input.pack_path.clone(),
    };

    let preview = if input.preview {
        Some(preview_evidence(
            backend
                .service
                .preview_agent_queue_prompt_pack_file(request.clone())
                .map_err(|error| error.to_string())?,
        )?)
    } else {
        None
    };

    let materialization_result = if input.materialize {
        Some(
            backend
                .service
                .materialize_agent_queue_prompt_pack_file(request)
                .map_err(|error| error.to_string())?,
        )
    } else {
        None
    };
    let materialization = materialization_result
        .as_ref()
        .map(materialization_evidence);

    let selected_task = match input.start_pack_task_id.as_deref() {
        Some(pack_task_id) => {
            let materialization_result = materialization_result.as_ref().ok_or_else(|| {
                "materialization is required before selected task start".to_owned()
            })?;
            Some(start_or_retry_selected_pack_task(
                &backend.service,
                materialization_result,
                &workspace_id,
                pack_task_id,
                false,
                None,
                false,
                runner,
            )?)
        }
        None => None,
    };

    let real_dogfood_run_performed = selected_task
        .as_ref()
        .map(|task| task.real_codex_invoked && task.completion_status.is_some())
        .unwrap_or(false);

    let exposed_database_path = backend
        .expose_database_path
        .then(|| display_path(&backend.database_path));
    let operator_context = DogfoodOperatorContextEvidence {
        context_source: backend.context_source,
        workspace_id: workspace_id.clone(),
        workspace_resolution_method: workspace_resolution.resolution_method.clone(),
        database_path: exposed_database_path.clone(),
        used_direct_database_path: backend.used_direct_database_path,
        endpoint_kind: None,
        endpoint_pid: None,
        profile_mode: None,
        workspace_root: None,
        app_launch_attempted: None,
        app_launch_command_summary: None,
    };

    Ok(DogfoodOperatorEvidence {
        operator_context,
        database_path: exposed_database_path,
        workspace_id,
        workspace_resolution,
        pack_path: input.pack_path,
        preview,
        materialization,
        provider_readiness: None,
        selected_task,
        resume_dogfood: None,
        boundaries: DogfoodOperatorBoundaryEvidence {
            frontend_materializer_canonical: false,
            queue_lifecycle_frontend_owned: false,
            widget_runs_created: false,
            widget_identity_used: false,
            scheduler_autodispatch_used: false,
            dependent_tasks_auto_started: false,
            automated_tests_launch_real_codex: false,
        },
        real_dogfood_run_performed,
    })
}

pub(crate) fn run_dogfood_operator_for_app_workspace_with_runner<F>(
    service: &WorkspaceService,
    input: DogfoodOperatorAppWorkspaceRunInput,
    runner: F,
) -> Result<DogfoodOperatorEvidence, String>
where
    F: FnOnce(
        &WorkspaceService,
        &SelectedAgentQueueTaskLocalStartSummary,
    ) -> Result<DogfoodOperatorWorkerOutcome, String>,
{
    validate_app_workspace_run_input(&input)?;
    let workspace = service
        .get_workspace_summary(&input.workspace_id)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "No active app workspace available for dogfood operator.".to_owned())?;
    let mut warnings = Vec::new();
    let workspace_root = match input.workspace_root.clone().or(workspace.root_path) {
        Some(root_path) if !root_path.trim().is_empty() => root_path,
        _ => {
            warnings.push("active app workspace has no root path".to_owned());
            "<no workspace root>".to_owned()
        }
    };
    let workspace_resolution = DogfoodWorkspaceResolutionEvidence {
        workspace_id: input.workspace_id.clone(),
        resolution_method: input.workspace_resolution_method.clone(),
        workspace_root: workspace_root.clone(),
        candidate_count: 0,
        ambiguity_avoided: false,
        dogfood_binding_reused: false,
        dogfood_workspace_created: false,
        warnings,
    };
    let workspace_id = workspace_resolution.workspace_id.clone();
    let request = AgentQueuePromptPackFileRequest {
        workspace_id: workspace_id.clone(),
        workspace_relative_path: input.pack_path.clone(),
    };

    let preview = if input.preview {
        Some(preview_evidence(
            service
                .preview_agent_queue_prompt_pack_file(request.clone())
                .map_err(|error| error.to_string())?,
        )?)
    } else {
        None
    };

    let materialization_result = if input.materialize {
        Some(
            service
                .materialize_agent_queue_prompt_pack_file(request)
                .map_err(|error| error.to_string())?,
        )
    } else {
        None
    };
    let materialization = materialization_result
        .as_ref()
        .map(materialization_evidence);

    let selected_task = match (
        input.start_pack_task_id.as_deref(),
        input.retry_pack_task_id.as_deref(),
    ) {
        (Some(pack_task_id), None) => {
            let materialization_result = materialization_result.as_ref().ok_or_else(|| {
                "materialization is required before selected task start".to_owned()
            })?;
            Some(start_or_retry_selected_pack_task(
                service,
                materialization_result,
                &workspace_id,
                pack_task_id,
                false,
                input.provider_readiness.as_ref(),
                input.allow_unknown_provider_readiness,
                runner,
            )?)
        }
        (None, Some(pack_task_id)) => {
            let materialization_result = materialization_result.as_ref().ok_or_else(|| {
                "materialization is required before selected task retry".to_owned()
            })?;
            Some(start_or_retry_selected_pack_task(
                service,
                materialization_result,
                &workspace_id,
                pack_task_id,
                true,
                input.provider_readiness.as_ref(),
                input.allow_unknown_provider_readiness,
                runner,
            )?)
        }
        (None, None) => None,
        (Some(_), Some(_)) => {
            return Err("choose only one selected task start or retry operation".to_owned())
        }
    };

    let real_dogfood_run_performed = selected_task
        .as_ref()
        .map(|task| task.real_codex_invoked && task.completion_status.is_some())
        .unwrap_or(false);
    let operator_context = DogfoodOperatorContextEvidence {
        context_source: "running_app_endpoint".to_owned(),
        workspace_id: workspace_id.clone(),
        workspace_resolution_method: workspace_resolution.resolution_method.clone(),
        database_path: None,
        used_direct_database_path: false,
        endpoint_kind: input.endpoint_kind,
        endpoint_pid: input.endpoint_pid,
        profile_mode: input.profile_mode,
        workspace_root: Some(workspace_root),
        app_launch_attempted: None,
        app_launch_command_summary: None,
    };

    Ok(DogfoodOperatorEvidence {
        operator_context,
        database_path: None,
        workspace_id,
        workspace_resolution,
        pack_path: input.pack_path,
        preview,
        materialization,
        provider_readiness: input.provider_readiness,
        selected_task,
        resume_dogfood: None,
        boundaries: DogfoodOperatorBoundaryEvidence {
            frontend_materializer_canonical: false,
            queue_lifecycle_frontend_owned: false,
            widget_runs_created: false,
            widget_identity_used: false,
            scheduler_autodispatch_used: false,
            dependent_tasks_auto_started: false,
            automated_tests_launch_real_codex: false,
        },
        real_dogfood_run_performed,
    })
}

pub(crate) fn run_dogfood_resume_for_app_workspace_with_runner<F>(
    service: &WorkspaceService,
    mut input: DogfoodOperatorAppWorkspaceRunInput,
    runner: F,
) -> Result<DogfoodOperatorEvidence, String>
where
    F: FnOnce(
        &WorkspaceService,
        &SelectedAgentQueueTaskLocalStartSummary,
    ) -> Result<DogfoodOperatorWorkerOutcome, String>,
{
    input.preview = true;
    input.materialize = true;
    input.start_pack_task_id = None;
    input.retry_pack_task_id = None;
    if !input.allow_worker_start {
        return Err(
            "refusing to resume dogfood without --allow-real-worker for the single selected start"
                .to_owned(),
        );
    }

    validate_app_workspace_run_input(&input)?;
    let workspace = service
        .get_workspace_summary(&input.workspace_id)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "No active app workspace available for dogfood operator.".to_owned())?;
    let mut warnings = Vec::new();
    let workspace_root = match input.workspace_root.clone().or(workspace.root_path) {
        Some(root_path) if !root_path.trim().is_empty() => root_path,
        _ => {
            warnings.push("active app workspace has no root path".to_owned());
            "<no workspace root>".to_owned()
        }
    };
    let workspace_resolution = DogfoodWorkspaceResolutionEvidence {
        workspace_id: input.workspace_id.clone(),
        resolution_method: input.workspace_resolution_method.clone(),
        workspace_root: workspace_root.clone(),
        candidate_count: 0,
        ambiguity_avoided: false,
        dogfood_binding_reused: false,
        dogfood_workspace_created: false,
        warnings,
    };
    let workspace_id = workspace_resolution.workspace_id.clone();
    let request = AgentQueuePromptPackFileRequest {
        workspace_id: workspace_id.clone(),
        workspace_relative_path: input.pack_path.clone(),
    };

    let preview = Some(preview_evidence(
        service
            .preview_agent_queue_prompt_pack_file(request.clone())
            .map_err(|error| error.to_string())?,
    )?);
    let materialization_result = service
        .materialize_agent_queue_prompt_pack_file(request)
        .map_err(|error| error.to_string())?;
    let materialization = Some(materialization_evidence(&materialization_result));
    let states_before = inspect_pack_task_states(service, &workspace_id, &materialization_result)?;
    let accepted_dependencies =
        finalize_safe_completed_pack_tasks(service, &workspace_id, &materialization_result)?;
    let states_after_finalization =
        inspect_pack_task_states(service, &workspace_id, &materialization_result)?;

    let selected_pack_task_id = states_after_finalization
        .iter()
        .find(|state| state.start_eligible)
        .map(|state| state.pack_task_id.clone());

    let selected_task = match selected_pack_task_id.as_deref() {
        Some(pack_task_id) => Some(start_or_retry_selected_pack_task(
            service,
            &materialization_result,
            &workspace_id,
            pack_task_id,
            false,
            input.provider_readiness.as_ref(),
            input.allow_unknown_provider_readiness,
            runner,
        )?),
        None => None,
    };

    let states_after_start =
        inspect_pack_task_states(service, &workspace_id, &materialization_result)?;
    let selected_queue_task_id = selected_task
        .as_ref()
        .map(|task| task.selected_queue_task_id.clone());
    let dependents_auto_started = unselected_pack_task_gained_run(
        &states_after_finalization,
        &states_after_start,
        selected_queue_task_id.as_deref(),
    );
    let started_new_worker_count = selected_task
        .as_ref()
        .filter(|task| task.would_start_workers)
        .map(|_| 1)
        .unwrap_or(0);
    let resume_status = match selected_task.as_ref() {
        Some(task) if task.launch_status == "launched" => "started_one_task",
        Some(task) => task.launch_status.as_str(),
        None => "no_eligible_task",
    }
    .to_owned();
    let real_dogfood_run_performed = selected_task
        .as_ref()
        .map(|task| task.real_codex_invoked && task.completion_status.is_some())
        .unwrap_or(false);
    let operator_context = DogfoodOperatorContextEvidence {
        context_source: "running_app_endpoint".to_owned(),
        workspace_id: workspace_id.clone(),
        workspace_resolution_method: workspace_resolution.resolution_method.clone(),
        database_path: None,
        used_direct_database_path: false,
        endpoint_kind: input.endpoint_kind,
        endpoint_pid: input.endpoint_pid,
        profile_mode: input.profile_mode,
        workspace_root: Some(workspace_root),
        app_launch_attempted: None,
        app_launch_command_summary: None,
    };

    Ok(DogfoodOperatorEvidence {
        operator_context,
        database_path: None,
        workspace_id,
        workspace_resolution,
        pack_path: input.pack_path,
        preview,
        materialization,
        provider_readiness: input.provider_readiness,
        selected_task: selected_task.clone(),
        resume_dogfood: Some(DogfoodOperatorResumeEvidence {
            status: resume_status,
            started_new_worker_count,
            selected_pack_task_id: selected_task
                .as_ref()
                .map(|task| task.selected_pack_task_id.clone()),
            selected_queue_task_id,
            accepted_dependencies,
            task_states_before: states_before,
            task_states_after_finalization: states_after_finalization,
            task_states_after_start: states_after_start,
            dependents_auto_started,
            widget_runs_created: selected_task
                .as_ref()
                .map(|task| task.created_widget_run)
                .unwrap_or(false),
            scheduler_autodispatch_used: false,
        }),
        boundaries: DogfoodOperatorBoundaryEvidence {
            frontend_materializer_canonical: false,
            queue_lifecycle_frontend_owned: false,
            widget_runs_created: selected_task
                .as_ref()
                .map(|task| task.created_widget_run)
                .unwrap_or(false),
            widget_identity_used: selected_task
                .as_ref()
                .map(|task| task.used_widget_identity)
                .unwrap_or(false),
            scheduler_autodispatch_used: false,
            dependent_tasks_auto_started: dependents_auto_started,
            automated_tests_launch_real_codex: false,
        },
        real_dogfood_run_performed,
    })
}

struct ResolvedOperatorBackendContext {
    service: WorkspaceService,
    database_path: PathBuf,
    context_source: String,
    used_direct_database_path: bool,
    expose_database_path: bool,
}

fn resolve_operator_backend_context(
    database_path: Option<&Path>,
    app_data_dir: Option<&Path>,
) -> Result<ResolvedOperatorBackendContext, String> {
    if let Some(database_path) = database_path {
        let service = workspace_service(database_path)?;
        return Ok(ResolvedOperatorBackendContext {
            service,
            database_path: database_path.to_path_buf(),
            context_source: "diagnostic_direct_database".to_owned(),
            used_direct_database_path: true,
            expose_database_path: true,
        });
    }

    let app_data_dir = match app_data_dir {
        Some(app_data_dir) => app_data_dir.to_path_buf(),
        None => default_headless_app_data_dir()?,
    };
    let database = initialize_database(&app_data_dir)
        .map_err(|error| format!("{APP_BACKEND_ENDPOINT_UNAVAILABLE} {error}"))?;
    let service = workspace_service(&database.path)
        .map_err(|error| format!("{APP_BACKEND_ENDPOINT_UNAVAILABLE} {error}"))?;

    Ok(ResolvedOperatorBackendContext {
        service,
        database_path: database.path,
        context_source: "headless_app_context".to_owned(),
        used_direct_database_path: false,
        expose_database_path: false,
    })
}

fn validate_run_input(input: &DogfoodOperatorRunInput) -> Result<(), String> {
    if input
        .workspace_id
        .as_ref()
        .is_some_and(|workspace_id| workspace_id.trim().is_empty())
    {
        return Err("workspace id must not be empty".to_owned());
    }
    validate_operation_input(
        &input.pack_path,
        input.preview,
        input.materialize,
        input.start_pack_task_id.as_deref(),
        None,
        input.allow_worker_start,
    )
}

fn validate_app_workspace_run_input(
    input: &DogfoodOperatorAppWorkspaceRunInput,
) -> Result<(), String> {
    if input.workspace_id.trim().is_empty() {
        return Err("workspace id must not be empty".to_owned());
    }
    validate_operation_input(
        &input.pack_path,
        input.preview,
        input.materialize,
        input.start_pack_task_id.as_deref(),
        input.retry_pack_task_id.as_deref(),
        input.allow_worker_start,
    )
}

fn validate_operation_input(
    pack_path: &str,
    preview: bool,
    materialize: bool,
    start_pack_task_id: Option<&str>,
    retry_pack_task_id: Option<&str>,
    allow_worker_start: bool,
) -> Result<(), String> {
    if pack_path.trim().is_empty() {
        return Err("prompt-pack path is required".to_owned());
    }
    if start_pack_task_id.is_some() && retry_pack_task_id.is_some() {
        return Err("choose only one selected task start or retry operation".to_owned());
    }
    if (start_pack_task_id.is_some() || retry_pack_task_id.is_some()) && !allow_worker_start {
        return Err(
            "refusing to start a real queue_local worker without --allow-real-worker".to_owned(),
        );
    }
    if (start_pack_task_id.is_some() || retry_pack_task_id.is_some()) && !materialize {
        return Err("materialization is required before selected task start".to_owned());
    }
    if !preview && !materialize && start_pack_task_id.is_none() && retry_pack_task_id.is_none() {
        return Err("choose --preview, --materialize, or --start-pack-task".to_owned());
    }
    Ok(())
}

pub fn resolve_dogfood_operator_workspace(
    service: &WorkspaceService,
    explicit_workspace_id: Option<&str>,
    workspace_root: Option<&Path>,
) -> Result<DogfoodWorkspaceResolutionEvidence, String> {
    let canonical_root = canonicalize_workspace_root(workspace_root)?;
    let canonical_root_key = canonical_path_key(&canonical_root);
    let workspace_root_display = display_path(&canonical_root);

    if let Some(workspace_id) = explicit_workspace_id {
        let workspace_id = workspace_id.trim();
        if workspace_id.is_empty() {
            return Err("explicit workspace id must not be empty".to_owned());
        }
        let workspace = service
            .get_workspace_summary(workspace_id)
            .map_err(|error| error.to_string())?
            .ok_or_else(|| format!("workspace not found: {workspace_id}"))?;
        let mut warnings = Vec::new();
        if !workspace_matches_canonical_root(&workspace, &canonical_root_key) {
            warnings.push(
                "explicit workspace id exists but does not canonicalize to the operator workspace root"
                    .to_owned(),
            );
        }
        return Ok(DogfoodWorkspaceResolutionEvidence {
            workspace_id: workspace.id,
            resolution_method: "explicit_workspace_id".to_owned(),
            workspace_root: workspace_root_display,
            candidate_count: 0,
            ambiguity_avoided: false,
            dogfood_binding_reused: false,
            dogfood_workspace_created: false,
            warnings,
        });
    }

    let context = service
        .ensure_dogfood_operator_workspace_for_root(&canonical_root_key, &workspace_root_display)
        .map_err(|error| error.to_string())?;
    Ok(DogfoodWorkspaceResolutionEvidence {
        workspace_id: context.workspace_id,
        resolution_method: context.workspace_resolution_method,
        workspace_root: context.workspace_root,
        candidate_count: 0,
        ambiguity_avoided: false,
        dogfood_binding_reused: context.dogfood_binding_reused,
        dogfood_workspace_created: context.dogfood_workspace_created,
        warnings: context.warnings,
    })
}

fn workspace_matches_canonical_root(
    workspace: &hobit_app::WorkspaceSummary,
    canonical_root_key: &str,
) -> bool {
    let Some(root_path) = workspace.root_path.as_deref() else {
        return false;
    };
    fs::canonicalize(root_path)
        .map(|root| canonical_path_key(&root) == canonical_root_key)
        .unwrap_or(false)
}

fn canonicalize_workspace_root(workspace_root: Option<&Path>) -> Result<PathBuf, String> {
    let root = match workspace_root {
        Some(root) => root.to_path_buf(),
        None => env::current_dir().map_err(|error| error.to_string())?,
    };
    let canonical = fs::canonicalize(&root).map_err(|error| {
        format!(
            "workspace root must be an existing directory: {} ({error})",
            root.display()
        )
    })?;
    if !canonical.is_dir() {
        return Err(format!(
            "workspace root must be an existing directory: {}",
            canonical.display()
        ));
    }
    Ok(canonical)
}

fn canonical_path_key(path: &Path) -> String {
    let normalized = display_path(path).replace('\\', "/");
    if cfg!(windows) {
        normalized.to_ascii_lowercase()
    } else {
        normalized
    }
}

fn display_path(path: &Path) -> String {
    let value = path.display().to_string();
    value
        .strip_prefix(r"\\?\")
        .unwrap_or(value.as_str())
        .to_owned()
}

fn inspect_pack_task_states(
    service: &WorkspaceService,
    workspace_id: &str,
    materialization: &AgentQueuePromptPackMaterializeResult,
) -> Result<Vec<DogfoodOperatorPackTaskStateEvidence>, String> {
    materialization
        .tasks
        .iter()
        .map(|task| {
            let aggregate = task
                .queue_task_id
                .as_deref()
                .map(|queue_task_id| {
                    service
                        .get_queue_item_aggregate(workspace_id, queue_task_id)
                        .map_err(|error| error.to_string())
                })
                .transpose()?
                .flatten();
            Ok(pack_task_state_evidence(
                &task.pack_task_id,
                task.queue_task_id.clone(),
                aggregate.as_ref(),
            ))
        })
        .collect()
}

fn pack_task_state_evidence(
    pack_task_id: &str,
    queue_task_id: Option<String>,
    aggregate: Option<&QueueItemAggregate>,
) -> DogfoodOperatorPackTaskStateEvidence {
    let latest_run = aggregate.and_then(|aggregate| aggregate.latest_run.as_ref());
    DogfoodOperatorPackTaskStateEvidence {
        pack_task_id: pack_task_id.to_owned(),
        queue_task_id,
        ticket_state: aggregate.map(|aggregate| aggregate.ticket_state.as_str().to_owned()),
        worker_run_state: aggregate.map(|aggregate| aggregate.worker_run_state.as_str().to_owned()),
        review_state: aggregate.map(|aggregate| aggregate.review_state.as_str().to_owned()),
        evidence_state: aggregate.map(|aggregate| aggregate.evidence_state.as_str().to_owned()),
        dependency_state: aggregate.map(|aggregate| aggregate.dependency_state.as_str().to_owned()),
        latest_run_id: latest_run.map(|run| run.run_id.clone()),
        latest_run_link_id: latest_run.map(|run| run.run_link_id.clone()),
        latest_run_status: latest_run.map(|run| run.status.clone()),
        start_eligible: aggregate.map(is_resume_start_eligible).unwrap_or(false),
        finalization_eligible: aggregate
            .map(is_resume_finalization_eligible)
            .unwrap_or(false),
    }
}

fn is_resume_start_eligible(aggregate: &QueueItemAggregate) -> bool {
    matches!(
        aggregate.ticket_state,
        QueueItemAggregateTicketState::Draft
            | QueueItemAggregateTicketState::Queued
            | QueueItemAggregateTicketState::Blocked
    ) && matches!(
        aggregate.worker_run_state,
        QueueItemAggregateWorkerRunState::NotStarted
            | QueueItemAggregateWorkerRunState::Unavailable
    ) && matches!(
        aggregate.dependency_state,
        QueueItemAggregateDependencyState::None | QueueItemAggregateDependencyState::Ready
    )
}

fn is_resume_finalization_eligible(aggregate: &QueueItemAggregate) -> bool {
    !matches!(
        aggregate.ticket_state,
        QueueItemAggregateTicketState::Done
            | QueueItemAggregateTicketState::Failure
            | QueueItemAggregateTicketState::Running
            | QueueItemAggregateTicketState::Draft
    ) && matches!(
        aggregate.worker_run_state,
        QueueItemAggregateWorkerRunState::Completed
    ) && matches!(
        aggregate.dependency_state,
        QueueItemAggregateDependencyState::None | QueueItemAggregateDependencyState::Ready
    ) && aggregate
        .latest_run
        .as_ref()
        .is_some_and(|run| run.status == "completed")
}

fn finalize_safe_completed_pack_tasks(
    service: &WorkspaceService,
    workspace_id: &str,
    materialization: &AgentQueuePromptPackMaterializeResult,
) -> Result<Vec<DogfoodOperatorDependencyFinalizationEvidence>, String> {
    let mut accepted = Vec::new();
    for task in &materialization.tasks {
        let Some(queue_task_id) = task.queue_task_id.as_deref() else {
            continue;
        };
        let Some(aggregate) = service
            .get_queue_item_aggregate(workspace_id, queue_task_id)
            .map_err(|error| error.to_string())?
        else {
            continue;
        };
        if matches!(aggregate.ticket_state, QueueItemAggregateTicketState::Done) {
            accepted.push(DogfoodOperatorDependencyFinalizationEvidence {
                pack_task_id: task.pack_task_id.clone(),
                queue_task_id: queue_task_id.to_owned(),
                status: "already_finalized".to_owned(),
                safe_to_finalize: true,
                run_id: aggregate.latest_run.as_ref().map(|run| run.run_id.clone()),
                run_link_id: aggregate
                    .latest_run
                    .as_ref()
                    .map(|run| run.run_link_id.clone()),
                evidence_bundle_id: None,
                review_message_id: None,
                completion_decision_id: None,
                blocker_code: None,
                blocker_message: None,
            });
            continue;
        }
        if !is_resume_finalization_eligible(&aggregate) {
            continue;
        }
        accepted.push(finalize_completed_pack_task(
            service,
            workspace_id,
            &task.pack_task_id,
            queue_task_id,
            &aggregate,
        )?);
    }
    Ok(accepted)
}

fn finalize_completed_pack_task(
    service: &WorkspaceService,
    workspace_id: &str,
    pack_task_id: &str,
    queue_task_id: &str,
    aggregate: &QueueItemAggregate,
) -> Result<DogfoodOperatorDependencyFinalizationEvidence, String> {
    let Some(latest_run) = aggregate.latest_run.as_ref() else {
        return Ok(finalization_blocked(
            pack_task_id,
            queue_task_id,
            None,
            None,
            "missing_latest_run",
            "completed Queue task has no latest run",
        ));
    };
    let run_id = latest_run.run_id.clone();
    let run_link_id = latest_run.run_link_id.clone();
    let actor_id = "hobit-dogfood-coordinator";
    let evidence_bundle_id = match service
        .get_agent_queue_worker_evidence_bundle(GetAgentQueueWorkerEvidenceBundleInput {
            workspace_id: workspace_id.to_owned(),
            queue_item_id: queue_task_id.to_owned(),
            run_id: Some(run_id.clone()),
        })
        .map_err(|error| error.to_string())?
        .state
    {
        AgentQueueWorkerEvidenceQueryState::Available => service
            .get_agent_queue_worker_evidence_bundle(GetAgentQueueWorkerEvidenceBundleInput {
                workspace_id: workspace_id.to_owned(),
                queue_item_id: queue_task_id.to_owned(),
                run_id: Some(run_id.clone()),
            })
            .map_err(|error| error.to_string())?
            .evidence_bundle
            .map(|bundle| bundle.bundle_id),
        AgentQueueWorkerEvidenceQueryState::NoEvidence => Some(
            service
                .record_agent_queue_worker_finished(RecordAgentQueueWorkerFinishedInput {
                    workspace_id: workspace_id.to_owned(),
                    queue_item_id: queue_task_id.to_owned(),
                    run_id: run_id.clone(),
                    outcome: "completed".to_owned(),
                    summary: Some(
                        "dogfood coordinator observed completed queue_local run".to_owned(),
                    ),
                    changed_files: Vec::new(),
                    changed_files_summary: None,
                    validation_summary: Some("validation handled by worker result".to_owned()),
                    error_summary: None,
                    worker_id: Some("hobit-dogfood-coordinator".to_owned()),
                    source: Some("dogfood_operator_resume".to_owned()),
                    metadata_json: None,
                    finished_at: None,
                })
                .map_err(|error| error.to_string())?
                .bundle_id,
        ),
        AgentQueueWorkerEvidenceQueryState::NotFound => {
            return Ok(finalization_blocked(
                pack_task_id,
                queue_task_id,
                Some(run_id),
                Some(run_link_id),
                "worker_evidence_target_not_found",
                "completed Queue task evidence target was not found",
            ))
        }
    };

    let mut review_message_id = None;
    let mut refreshed = service
        .get_queue_item_aggregate(workspace_id, queue_task_id)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| format!("queue task not found: {queue_task_id}"))?;
    if !is_mark_done_review_ready(&refreshed) {
        let review = service
            .create_agent_queue_review_message(CreateAgentQueueReviewMessageInput {
                workspace_id: workspace_id.to_owned(),
                queue_item_id: queue_task_id.to_owned(),
                actor_id: actor_id.to_owned(),
                message_body: Some(
                    "Dogfood coordinator accepted completed dependency for resume.".to_owned(),
                ),
                run_id: Some(run_id.clone()),
                evidence_bundle_id: evidence_bundle_id.clone(),
            })
            .map_err(|error| error.to_string())?;
        review_message_id = review.message_id.or_else(|| {
            review
                .blocker
                .as_ref()
                .and_then(|blocker| blocker.existing_message_id.clone())
        });
        if !matches!(
            review.status,
            AgentQueueReviewCreateMessageStatus::Succeeded
                | AgentQueueReviewCreateMessageStatus::AlreadyExists
        ) {
            return Ok(finalization_blocked(
                pack_task_id,
                queue_task_id,
                Some(run_id),
                Some(run_link_id),
                review
                    .blocker
                    .as_ref()
                    .map(|blocker| blocker.blocker_code.as_str())
                    .unwrap_or(review.status.as_str()),
                review
                    .blocker
                    .as_ref()
                    .map(|blocker| blocker.blocker_message.as_str())
                    .unwrap_or("review message could not be created"),
            ));
        }
        refreshed = service
            .get_queue_item_aggregate(workspace_id, queue_task_id)
            .map_err(|error| error.to_string())?
            .ok_or_else(|| format!("queue task not found: {queue_task_id}"))?;
        if !is_mark_done_review_ready(&refreshed) {
            let Some(message_id) = review_message_id.clone() else {
                return Ok(finalization_blocked(
                    pack_task_id,
                    queue_task_id,
                    Some(run_id),
                    Some(run_link_id),
                    "review_message_missing",
                    "review message id was unavailable for ACK",
                ));
            };
            service
                .ack_agent_queue_review_message(AckAgentQueueReviewMessageInput {
                    workspace_id: workspace_id.to_owned(),
                    queue_item_id: queue_task_id.to_owned(),
                    message_id: message_id.clone(),
                    actor_id: actor_id.to_owned(),
                })
                .map_err(|error| error.to_string())?;
            review_message_id = Some(message_id);
        }
    }

    let completion = service
        .mark_agent_queue_item_done(MarkAgentQueueItemDoneInput {
            workspace_id: workspace_id.to_owned(),
            queue_item_id: queue_task_id.to_owned(),
            actor_id: actor_id.to_owned(),
            confirmation_token: AGENT_QUEUE_ACCEPTED_COMPLETION_CONFIRMATION_TOKEN.to_owned(),
            reason: Some("accepted by dogfood coordinator resume".to_owned()),
            run_id: Some(run_id.clone()),
            review_message_id: review_message_id.clone(),
        })
        .map_err(|error| error.to_string())?;
    let finalized = matches!(
        completion.status,
        AgentQueueCompletionCommandStatus::Succeeded
            | AgentQueueCompletionCommandStatus::AlreadyDone
    );
    Ok(DogfoodOperatorDependencyFinalizationEvidence {
        pack_task_id: pack_task_id.to_owned(),
        queue_task_id: queue_task_id.to_owned(),
        status: completion.status.as_str().to_owned(),
        safe_to_finalize: true,
        run_id: Some(run_id),
        run_link_id: Some(run_link_id),
        evidence_bundle_id,
        review_message_id: completion.review_message_id.or(review_message_id),
        completion_decision_id: completion.decision_id,
        blocker_code: completion
            .blocker
            .as_ref()
            .map(|blocker| blocker.blocker_code.clone()),
        blocker_message: if finalized {
            None
        } else {
            completion
                .blocker
                .as_ref()
                .map(|blocker| blocker.blocker_message.clone())
        },
    })
}

fn is_mark_done_review_ready(aggregate: &QueueItemAggregate) -> bool {
    matches!(
        aggregate.ticket_state,
        QueueItemAggregateTicketState::InReview
    ) && matches!(
        aggregate.review_state,
        QueueItemAggregateReviewState::InReview
    )
}

fn finalization_blocked(
    pack_task_id: &str,
    queue_task_id: &str,
    run_id: Option<String>,
    run_link_id: Option<String>,
    blocker_code: &str,
    blocker_message: &str,
) -> DogfoodOperatorDependencyFinalizationEvidence {
    DogfoodOperatorDependencyFinalizationEvidence {
        pack_task_id: pack_task_id.to_owned(),
        queue_task_id: queue_task_id.to_owned(),
        status: "blocked".to_owned(),
        safe_to_finalize: false,
        run_id,
        run_link_id,
        evidence_bundle_id: None,
        review_message_id: None,
        completion_decision_id: None,
        blocker_code: Some(blocker_code.to_owned()),
        blocker_message: Some(blocker_message.to_owned()),
    }
}

fn unselected_pack_task_gained_run(
    before: &[DogfoodOperatorPackTaskStateEvidence],
    after: &[DogfoodOperatorPackTaskStateEvidence],
    selected_queue_task_id: Option<&str>,
) -> bool {
    after.iter().any(|after_state| {
        if after_state.queue_task_id.as_deref() == selected_queue_task_id {
            return false;
        }
        let before_run = before
            .iter()
            .find(|before_state| before_state.pack_task_id == after_state.pack_task_id)
            .and_then(|before_state| before_state.latest_run_link_id.as_deref());
        before_run != after_state.latest_run_link_id.as_deref()
            && after_state.latest_run_link_id.is_some()
    })
}

fn start_or_retry_selected_pack_task<F>(
    service: &WorkspaceService,
    materialization: &AgentQueuePromptPackMaterializeResult,
    workspace_id: &str,
    pack_task_id: &str,
    retry_failed: bool,
    provider_readiness: Option<&QueueLocalProviderReadinessSummary>,
    allow_unknown_provider_readiness: bool,
    runner: F,
) -> Result<DogfoodOperatorSelectedTaskEvidence, String>
where
    F: FnOnce(
        &WorkspaceService,
        &SelectedAgentQueueTaskLocalStartSummary,
    ) -> Result<DogfoodOperatorWorkerOutcome, String>,
{
    let task = materialization
        .tasks
        .iter()
        .find(|task| task.pack_task_id == pack_task_id)
        .ok_or_else(|| format!("pack task id was not materialized: {pack_task_id}"))?;
    let queue_task_id = task
        .queue_task_id
        .as_deref()
        .ok_or_else(|| format!("pack task id has no Queue task mapping: {pack_task_id}"))?;

    if let Some(readiness) = provider_readiness {
        if provider_readiness_blocks_launch(readiness, allow_unknown_provider_readiness) {
            return Ok(provider_readiness_blocked_selected_task(
                pack_task_id,
                queue_task_id,
                readiness,
            ));
        }
    }

    let input = StartSelectedAgentQueueTaskLocalInput {
        workspace_id: workspace_id.to_owned(),
        queue_item_id: queue_task_id.to_owned(),
    };
    let start = if retry_failed {
        service.retry_selected_agent_queue_task_local(input)
    } else {
        service.start_selected_agent_queue_task_local(input)
    }
    .map_err(|error| error.to_string())?;

    let worker = if start.status == "launched" {
        match runner(service, &start) {
            Ok(outcome) => Some(outcome),
            Err(error) => {
                finish_selected_task_after_runner_failure(service, &start)?;
                return Err(error);
            }
        }
    } else {
        None
    };

    let blocker_code = start
        .blocker
        .as_ref()
        .map(|blocker| blocker.blocker_code.clone());
    let blocked_reason = start
        .blocker
        .as_ref()
        .map(|blocker| blocker.blocker_message.clone());
    let fake_worker_used = worker
        .as_ref()
        .map(|outcome| outcome.fake_worker_used)
        .unwrap_or(false);
    let real_codex_invoked = worker
        .as_ref()
        .map(|outcome| outcome.real_codex_invoked)
        .unwrap_or(false);
    let completion_status = worker
        .as_ref()
        .and_then(|outcome| outcome.completion_status.clone());
    let terminal_queue_task_status = worker
        .as_ref()
        .and_then(|outcome| outcome.terminal_queue_task_status.clone());
    let worker_exit_code = worker.as_ref().and_then(|outcome| outcome.worker_exit_code);
    let worker_stdout_tail = worker
        .as_ref()
        .and_then(|outcome| outcome.worker_stdout_tail.clone());
    let worker_stderr_tail = worker
        .as_ref()
        .and_then(|outcome| outcome.worker_stderr_tail.clone());
    let worker_error_message = worker
        .as_ref()
        .and_then(|outcome| outcome.worker_error_message.clone());

    Ok(DogfoodOperatorSelectedTaskEvidence {
        selected_pack_task_id: pack_task_id.to_owned(),
        selected_queue_task_id: queue_task_id.to_owned(),
        run_id: start.run_id,
        run_link_id: start.run_link_id,
        launch_status: start.status,
        blocked_reason,
        blocker_code,
        created_run_link: start.created_run_link,
        created_widget_run: start.created_widget_run,
        used_workflow_slot: start.used_workflow_slot,
        used_widget_identity: start.used_widget_identity,
        would_start_workers: worker.is_some(),
        fake_worker_used,
        real_codex_invoked,
        completion_status,
        terminal_queue_task_status,
        worker_exit_code,
        worker_stdout_tail,
        worker_stderr_tail,
        worker_error_message,
        scheduler_autodispatch: false,
        dependent_tasks_auto_started: false,
    })
}

fn provider_readiness_blocks_launch(
    readiness: &QueueLocalProviderReadinessSummary,
    allow_unknown_provider_readiness: bool,
) -> bool {
    readiness.status != "ready"
        && !(allow_unknown_provider_readiness && readiness.status == "unknown")
}

fn provider_readiness_blocked_selected_task(
    pack_task_id: &str,
    queue_task_id: &str,
    readiness: &QueueLocalProviderReadinessSummary,
) -> DogfoodOperatorSelectedTaskEvidence {
    DogfoodOperatorSelectedTaskEvidence {
        selected_pack_task_id: pack_task_id.to_owned(),
        selected_queue_task_id: queue_task_id.to_owned(),
        run_id: None,
        run_link_id: None,
        launch_status: "provider_readiness_blocked".to_owned(),
        blocked_reason: Some("Codex provider readiness blocked selected-task launch.".to_owned()),
        blocker_code: readiness
            .blockers
            .first()
            .cloned()
            .or_else(|| Some("provider_readiness_blocked".to_owned())),
        created_run_link: false,
        created_widget_run: false,
        used_workflow_slot: false,
        used_widget_identity: false,
        would_start_workers: false,
        fake_worker_used: false,
        real_codex_invoked: false,
        completion_status: Some("provider_readiness_blocked".to_owned()),
        terminal_queue_task_status: None,
        worker_exit_code: None,
        worker_stdout_tail: None,
        worker_stderr_tail: None,
        worker_error_message: None,
        scheduler_autodispatch: false,
        dependent_tasks_auto_started: false,
    }
}

fn finish_selected_task_after_runner_failure(
    service: &WorkspaceService,
    start: &SelectedAgentQueueTaskLocalStartSummary,
) -> Result<(), String> {
    let run_id = start.run_id.clone().ok_or_else(|| {
        "selected task start had no run id to finish after launch failure".to_owned()
    })?;
    service
        .finish_assigned_agent_queue_task_run(FinishAssignedAgentQueueTaskRunInput {
            workspace_id: start.workspace_id.clone(),
            queue_item_id: start.queue_item_id.clone(),
            executor_widget_instance_id: start.executor_widget_instance_id.clone(),
            run_id,
            direct_work_status: "failed".to_owned(),
        })
        .map(|_| ())
        .map_err(|error| error.to_string())
}

fn preview_evidence(
    result: AgentQueuePromptPackPreviewResult,
) -> Result<DogfoodOperatorPreviewEvidence, String> {
    if result.status != "succeeded" {
        return Err(format!(
            "prompt-pack preview failed: {}",
            diagnostic_summary(&result.errors)
        ));
    }
    let preview = result
        .preview
        .ok_or_else(|| "prompt-pack preview succeeded without preview payload".to_owned())?;
    Ok(DogfoodOperatorPreviewEvidence {
        pack_id: preview.pack.pack_id,
        pack_spec_hash: preview.pack_spec_hash,
        run_settings_hash: preview.run_settings_hash,
        dependency_spec_hash: preview.dependency_spec_hash,
        full_preview_hash: preview.full_preview_hash,
        task_count: preview.task_count,
        dependency_count: preview.dependency_count,
        materialization_status: preview.materialization_status,
        would_start_workers: preview.would_start_workers,
        would_create_run_links: preview.would_create_run_links,
        would_mutate_queue: preview.would_mutate_queue,
    })
}

fn materialization_evidence(
    result: &AgentQueuePromptPackMaterializeResult,
) -> DogfoodOperatorMaterializationEvidence {
    DogfoodOperatorMaterializationEvidence {
        materialization_status: result.status.clone(),
        pack_id: result.pack_id.clone(),
        pack_spec_hash: result.pack_spec_hash.clone(),
        run_settings_hash: result.run_settings_hash.clone(),
        dependency_spec_hash: result.dependency_spec_hash.clone(),
        full_preview_hash: result.full_preview_hash.clone(),
        task_count: result.task_count,
        created_count: result.created_count,
        reused_count: result.reused_count,
        conflict_count: result.conflict_count,
        mappings: result
            .tasks
            .iter()
            .map(|task| DogfoodOperatorTaskMappingEvidence {
                pack_task_id: task.pack_task_id.clone(),
                queue_task_id: task.queue_task_id.clone(),
                task_spec_hash: task.task_spec_hash.clone(),
                status: task.status.clone(),
            })
            .collect(),
        dependency_remap: result
            .tasks
            .iter()
            .map(|task| DogfoodOperatorDependencyRemapEvidence {
                pack_task_id: task.pack_task_id.clone(),
                dependency_queue_task_ids: task.dependency_queue_task_ids.clone(),
            })
            .collect(),
        would_start_workers: result.would_start_workers,
        would_create_run_links: result.would_create_run_links,
        would_mutate_queue: result.would_mutate_queue,
    }
}

pub(crate) fn real_worker_runner(
    service: &WorkspaceService,
    start: &SelectedAgentQueueTaskLocalStartSummary,
) -> Result<DogfoodOperatorWorkerOutcome, String> {
    let run_id = start
        .run_id
        .clone()
        .ok_or_else(|| "selected Queue task start did not return a run id".to_owned())?;
    let direct_work_input = start.direct_work_input.clone().ok_or_else(|| {
        "selected Queue task start did not return backend-prepared launch data".to_owned()
    })?;
    let summary = service
        .run_backend_owned_agent_queue_direct_work_stream_with_cancellation(
            direct_work_input,
            &run_id,
            CodexDirectStreamCancellationToken::new(),
            |_event| {},
        )
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "queue_local Direct Work completed without a summary".to_owned())?;
    let task = service
        .finish_assigned_agent_queue_task_run(FinishAssignedAgentQueueTaskRunInput {
            workspace_id: start.workspace_id.clone(),
            queue_item_id: start.queue_item_id.clone(),
            executor_widget_instance_id: start.executor_widget_instance_id.clone(),
            run_id,
            direct_work_status: summary.status.clone(),
        })
        .map_err(|error| error.to_string())?;

    Ok(DogfoodOperatorWorkerOutcome {
        worker_mode: "real_queue_local".to_owned(),
        fake_worker_used: false,
        real_codex_invoked: true,
        completion_status: Some(summary.status),
        terminal_queue_task_status: Some(task.status),
        worker_exit_code: summary.exit_code,
        worker_stdout_tail: bounded_text_tail(summary.stdout.as_str(), WORKER_OUTPUT_TAIL_BYTES),
        worker_stderr_tail: bounded_text_tail(summary.stderr.as_str(), WORKER_OUTPUT_TAIL_BYTES),
        worker_error_message: summary.error_message,
    })
}

fn bounded_text_tail(value: &str, max_bytes: usize) -> Option<String> {
    if value.trim().is_empty() {
        return None;
    }
    if value.len() <= max_bytes {
        return Some(value.to_owned());
    }
    let mut start = value.len().saturating_sub(max_bytes);
    while !value.is_char_boundary(start) {
        start += 1;
    }
    Some(value[start..].to_owned())
}

fn workspace_service(db_path: &Path) -> Result<WorkspaceService, String> {
    open_store_for_operator(db_path)
        .map(WorkspaceService::new)
        .map_err(|error| error.to_string())
}

fn open_store_for_operator(db_path: &Path) -> Result<SqliteStore, String> {
    if !db_path.exists() {
        return Err(format!(
            "database path must point to an existing Hobit SQLite database: {}",
            db_path.display()
        ));
    }
    if db_path.is_dir() {
        return Err(format!(
            "database path must point to a SQLite file, not a directory: {}",
            db_path.display()
        ));
    }
    let store = SqliteStore::open(db_path).map_err(|error| error.to_string())?;
    store.init_schema().map_err(|error| error.to_string())?;
    Ok(store)
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct CliOptions {
    database: Option<PathBuf>,
    workspace_id: Option<String>,
    workspace_root: Option<PathBuf>,
    pack_path: Option<String>,
    preview: bool,
    materialize: bool,
    start_pack_task_id: Option<String>,
    allow_real_worker: bool,
    json: bool,
    report_path: Option<PathBuf>,
    list_workspaces: bool,
    resolve_workspace: bool,
    help: bool,
}

fn parse_cli_options(args: Vec<String>) -> Result<CliOptions, String> {
    let mut options = CliOptions {
        database: None,
        workspace_id: None,
        workspace_root: None,
        pack_path: None,
        preview: false,
        materialize: false,
        start_pack_task_id: None,
        allow_real_worker: false,
        json: false,
        report_path: None,
        list_workspaces: false,
        resolve_workspace: false,
        help: false,
    };

    let mut index = 0;
    while index < args.len() {
        match args[index].as_str() {
            "--help" | "-h" => options.help = true,
            "--database" => {
                index += 1;
                options.database = Some(PathBuf::from(required_arg(&args, index, "--database")?));
            }
            "--workspace-id" => {
                index += 1;
                options.workspace_id = Some(required_arg(&args, index, "--workspace-id")?);
            }
            "--workspace-root" => {
                index += 1;
                options.workspace_root = Some(PathBuf::from(required_arg(
                    &args,
                    index,
                    "--workspace-root",
                )?));
            }
            "--pack" => {
                index += 1;
                options.pack_path = Some(required_arg(&args, index, "--pack")?);
            }
            "--preview" => options.preview = true,
            "--materialize" => options.materialize = true,
            "--start-pack-task" => {
                index += 1;
                options.start_pack_task_id = Some(required_arg(&args, index, "--start-pack-task")?);
            }
            "--allow-real-worker" => options.allow_real_worker = true,
            "--json" => options.json = true,
            "--report" => {
                index += 1;
                options.report_path = Some(PathBuf::from(required_arg(&args, index, "--report")?));
            }
            "--list-workspaces" => options.list_workspaces = true,
            "--resolve-workspace" => options.resolve_workspace = true,
            value => return Err(format!("unexpected argument: {value}")),
        }
        index += 1;
    }

    Ok(options)
}

fn default_headless_app_data_dir() -> Result<PathBuf, String> {
    if let Some(appdata) = env::var_os("APPDATA") {
        return Ok(PathBuf::from(appdata).join("com.hobit.desktop"));
    }

    if let Some(xdg_data_home) = env::var_os("XDG_DATA_HOME") {
        return Ok(PathBuf::from(xdg_data_home).join("com.hobit.desktop"));
    }

    let Some(home) = env::var_os("HOME").map(PathBuf::from) else {
        return Err(format!(
            "{APP_BACKEND_ENDPOINT_UNAVAILABLE} Unable to resolve the Hobit app data directory."
        ));
    };

    if cfg!(target_os = "macos") {
        Ok(home
            .join("Library")
            .join("Application Support")
            .join("com.hobit.desktop"))
    } else {
        Ok(home.join(".local").join("share").join("com.hobit.desktop"))
    }
}

fn required_arg(args: &[String], index: usize, flag: &str) -> Result<String, String> {
    args.get(index)
        .filter(|value| !value.trim().is_empty())
        .cloned()
        .ok_or_else(|| format!("{flag} requires a value"))
}

fn print_workspaces(service: &WorkspaceService) -> Result<(), String> {
    let workspaces = service
        .list_workspaces()
        .map_err(|error| error.to_string())?;
    if workspaces.is_empty() {
        println!("No workspaces found.");
        return Ok(());
    }
    for workspace in workspaces {
        let root = workspace.root_path.as_deref().unwrap_or("<no root>");
        println!(
            "{}\t{}\t{}",
            workspace.id,
            workspace.title.replace('\t', " "),
            root
        );
    }
    Ok(())
}

fn print_workspace_resolution(resolution: &DogfoodWorkspaceResolutionEvidence) {
    println!("Queue dogfood workspace resolution");
    println!("workspaceId: {}", resolution.workspace_id);
    println!("method: {}", resolution.resolution_method);
    println!("workspaceRoot: {}", resolution.workspace_root);
    println!("candidateCount: {}", resolution.candidate_count);
    println!("ambiguityAvoided: {}", resolution.ambiguity_avoided);
    println!(
        "dogfoodBindingReused: {}",
        resolution.dogfood_binding_reused
    );
    println!(
        "dogfoodWorkspaceCreated: {}",
        resolution.dogfood_workspace_created
    );
    for warning in &resolution.warnings {
        println!("warning: {warning}");
    }
}

fn print_human_evidence(evidence: &DogfoodOperatorEvidence) {
    println!("Queue dogfood operator evidence");
    println!(
        "operatorContext.contextSource: {}",
        evidence.operator_context.context_source
    );
    println!(
        "operatorContext.usedDirectDatabasePath: {}",
        evidence.operator_context.used_direct_database_path
    );
    if let Some(database_path) = &evidence.operator_context.database_path {
        println!("operatorContext.databasePath: {database_path}");
    }
    if let Some(endpoint_kind) = &evidence.operator_context.endpoint_kind {
        println!("operatorContext.endpointKind: {endpoint_kind}");
    }
    if let Some(endpoint_pid) = evidence.operator_context.endpoint_pid {
        println!("operatorContext.endpointPid: {endpoint_pid}");
    }
    if let Some(profile_mode) = &evidence.operator_context.profile_mode {
        println!("operatorContext.profileMode: {profile_mode}");
    }
    println!("workspaceId: {}", evidence.workspace_id);
    println!(
        "workspaceResolution.method: {}",
        evidence.workspace_resolution.resolution_method
    );
    println!(
        "workspaceResolution.candidateCount: {}",
        evidence.workspace_resolution.candidate_count
    );
    println!("pack: {}", evidence.pack_path);
    if let Some(preview) = &evidence.preview {
        println!("preview.packId: {}", preview.pack_id);
        println!("preview.packSpecHash: {}", preview.pack_spec_hash);
        println!("preview.runSettingsHash: {}", preview.run_settings_hash);
        println!(
            "preview.dependencySpecHash: {}",
            preview.dependency_spec_hash
        );
        println!(
            "preview.materializationStatus: {}",
            preview.materialization_status
        );
        println!("preview.wouldStartWorkers: {}", preview.would_start_workers);
        println!(
            "preview.wouldCreateRunLinks: {}",
            preview.would_create_run_links
        );
        println!("preview.wouldMutateQueue: {}", preview.would_mutate_queue);
    }
    if let Some(materialization) = &evidence.materialization {
        println!(
            "materialization.status: {}",
            materialization.materialization_status
        );
        println!(
            "materialization.createdCount: {}",
            materialization.created_count
        );
        println!(
            "materialization.reusedCount: {}",
            materialization.reused_count
        );
        println!(
            "materialization.conflictCount: {}",
            materialization.conflict_count
        );
        for mapping in &materialization.mappings {
            println!(
                "task.{}: {}",
                mapping.pack_task_id,
                mapping.queue_task_id.as_deref().unwrap_or("<none>")
            );
        }
    }
    if let Some(selected) = &evidence.selected_task {
        println!("selected.packTaskId: {}", selected.selected_pack_task_id);
        println!("selected.queueTaskId: {}", selected.selected_queue_task_id);
        println!(
            "selected.runLinkId: {}",
            selected.run_link_id.as_deref().unwrap_or("<none>")
        );
        println!("selected.launchStatus: {}", selected.launch_status);
        println!(
            "selected.completionStatus: {}",
            selected
                .completion_status
                .as_deref()
                .unwrap_or("<not completed>")
        );
    }
    println!(
        "realDogfoodRunPerformed: {}",
        evidence.real_dogfood_run_performed
    );
}

fn write_report(path: &Path, payload: &str) -> Result<(), String> {
    if let Some(parent) = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(path, payload).map_err(|error| error.to_string())
}

fn print_help() {
    println!(
        "Usage:
  queue-dogfood-operator --pack <workspace-relative-json> --preview [--json]
  queue-dogfood-operator --pack <workspace-relative-json> --materialize [--json]
  queue-dogfood-operator --pack <workspace-relative-json> --materialize --start-pack-task dogfood-foundation-checkpoint --allow-real-worker [--json]
  queue-dogfood-operator --resolve-workspace [--json]

Default mode boots the Hobit app/backend context and uses a backend-owned dogfood workspace ensure path.
--database <sqlite>, --workspace-id, and --list-workspaces are diagnostic/dev overrides, not the default operator contract.
Use --workspace-root to override the default current working directory root.
Default --pack is docs/dogfood/queue-prompt-packs/hobit-queue-dogfood-next.json.
Starting a selected task is refused unless --allow-real-worker is present."
    );
}

fn diagnostic_summary(errors: &[hobit_app::AgentQueuePromptPackPreviewDiagnostic]) -> String {
    errors
        .iter()
        .map(|error| format!("{}: {}", error.code, error.message))
        .collect::<Vec<_>>()
        .join("; ")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    use hobit_app::{MarkAgentQueueItemDoneInput, RecordAgentQueueWorkerFinishedInput};
    use serde_json::Value;

    const DOGFOOD_PACK: &str = "docs/dogfood/queue-prompt-packs/hobit-queue-dogfood-next.json";

    #[test]
    fn dogfood_operator_resolver_explicit_workspace_id_must_exist() {
        let (db_path, workspace_id) = test_workspace("Dogfood resolver explicit");
        let root = repo_root_for_test();
        let service = workspace_service(&db_path).expect("service");

        let resolution =
            resolve_dogfood_operator_workspace(&service, Some(&workspace_id), Some(&root))
                .expect("explicit workspace resolves");
        assert_eq!(resolution.workspace_id, workspace_id);
        assert_eq!(resolution.resolution_method, "explicit_workspace_id");
        assert_eq!(resolution.dogfood_workspace_created, false);

        let missing =
            resolve_dogfood_operator_workspace(&service, Some("missing-workspace"), Some(&root))
                .expect_err("missing explicit workspace fails");
        assert!(missing.contains("workspace not found"));
        remove_test_db_files(&db_path);
    }

    #[test]
    fn dogfood_operator_resolver_ensures_dogfood_workspace_without_workspace_id() {
        let (db_path, workspace_id) = test_workspace("Dogfood resolver app owned root");
        let root = repo_root_for_test();
        let service = workspace_service(&db_path).expect("service");

        let resolution = resolve_dogfood_operator_workspace(&service, None, Some(&root))
            .expect("dogfood workspace resolves");

        assert_ne!(resolution.workspace_id, workspace_id);
        assert_eq!(resolution.resolution_method, "ensure_dogfood_workspace");
        assert_eq!(resolution.candidate_count, 0);
        assert_eq!(resolution.ambiguity_avoided, false);
        assert_eq!(resolution.dogfood_binding_reused, false);
        assert_eq!(resolution.dogfood_workspace_created, true);
        remove_test_db_files(&db_path);
    }

    #[test]
    fn dogfood_operator_resolver_multiple_same_root_creates_and_reuses_dogfood_binding() {
        let db_path = unique_test_db_path();
        let store = SqliteStore::open(&db_path).expect("open store");
        store.init_schema().expect("init schema");
        let service = WorkspaceService::new(store);
        let root_path = repo_root_for_test();
        let root = root_path.display().to_string();
        let first = service
            .create_empty_workspace_with_root_path("Duplicate A", None, Some(root.clone()))
            .expect("create first duplicate");
        let second = service
            .create_empty_workspace_with_root_path("Duplicate B", None, Some(root))
            .expect("create second duplicate");

        let ensured = resolve_dogfood_operator_workspace(&service, None, Some(&root_path))
            .expect("ensure dogfood workspace");
        assert_eq!(ensured.resolution_method, "ensure_dogfood_workspace");
        assert_eq!(ensured.candidate_count, 0);
        assert_eq!(ensured.ambiguity_avoided, false);
        assert_eq!(ensured.dogfood_workspace_created, true);
        assert_ne!(ensured.workspace_id, first.id);
        assert_ne!(ensured.workspace_id, second.id);

        let reused = resolve_dogfood_operator_workspace(&service, None, Some(&root_path))
            .expect("reuse dogfood binding");
        assert_eq!(reused.workspace_id, ensured.workspace_id);
        assert_eq!(reused.resolution_method, "persisted_dogfood_binding");
        assert_eq!(reused.candidate_count, 0);
        assert_eq!(reused.ambiguity_avoided, false);
        assert_eq!(reused.dogfood_binding_reused, true);
        assert_eq!(reused.dogfood_workspace_created, false);

        let service = workspace_service(&db_path).expect("service");
        assert!(service
            .list_agent_queue_tasks(&ensured.workspace_id)
            .expect("list dogfood tasks")
            .is_empty());
        let store = SqliteStore::open(&db_path).expect("open store");
        assert!(store
            .list_widget_runs_for_widget(hobit_app::QUEUE_LOCAL_BACKEND_EXECUTION_TARGET_ID)
            .expect("widget runs")
            .is_empty());
        remove_test_db_files(&db_path);
    }

    #[test]
    fn dogfood_operator_default_context_preview_requires_no_database_or_workspace_id() {
        let app_data_dir = unique_test_app_data_dir();

        let evidence = run_dogfood_operator_with_runner(
            DogfoodOperatorRunInput {
                database_path: None,
                app_data_dir: Some(app_data_dir.clone()),
                workspace_id: None,
                workspace_root: Some(repo_root_for_test()),
                pack_path: DOGFOOD_PACK.to_owned(),
                preview: true,
                materialize: false,
                start_pack_task_id: None,
                allow_worker_start: false,
            },
            panic_runner,
        )
        .expect("auto-resolved preview");

        assert_eq!(
            evidence.operator_context.context_source,
            "headless_app_context"
        );
        assert_eq!(evidence.operator_context.used_direct_database_path, false);
        assert!(evidence.operator_context.database_path.is_none());
        assert_eq!(
            evidence.workspace_resolution.resolution_method,
            "ensure_dogfood_workspace"
        );
        assert_eq!(
            evidence.preview.expect("preview").would_start_workers,
            false
        );
        remove_test_app_data_dir(&app_data_dir);
    }

    #[test]
    fn dogfood_operator_default_context_materializes_with_backend_service() {
        let app_data_dir = unique_test_app_data_dir();

        let evidence = run_dogfood_operator_with_runner(
            DogfoodOperatorRunInput {
                database_path: None,
                app_data_dir: Some(app_data_dir.clone()),
                workspace_id: None,
                workspace_root: Some(repo_root_for_test()),
                pack_path: DOGFOOD_PACK.to_owned(),
                preview: false,
                materialize: true,
                start_pack_task_id: None,
                allow_worker_start: false,
            },
            panic_runner,
        )
        .expect("default materialize evidence");

        assert_eq!(evidence.operator_context.used_direct_database_path, false);
        let materialization = evidence.materialization.expect("materialization");
        assert_eq!(materialization.materialization_status, "created");
        assert_eq!(materialization.created_count, 5);
        assert_eq!(materialization.would_start_workers, false);
        assert_eq!(evidence.boundaries.frontend_materializer_canonical, false);
        assert_eq!(evidence.boundaries.queue_lifecycle_frontend_owned, false);
        assert_no_widget_runs_or_links_for_materialized(
            &app_data_dir.join("hobit.sqlite3"),
            &evidence.workspace_id,
            &materialization,
        );
        remove_test_app_data_dir(&app_data_dir);
    }

    #[test]
    fn dogfood_operator_default_context_selected_start_uses_backend_fake_runner() {
        let app_data_dir = unique_test_app_data_dir();
        let mut launch_count = 0usize;

        let evidence = run_dogfood_operator_with_runner(
            DogfoodOperatorRunInput {
                database_path: None,
                app_data_dir: Some(app_data_dir.clone()),
                workspace_id: None,
                workspace_root: Some(repo_root_for_test()),
                pack_path: DOGFOOD_PACK.to_owned(),
                preview: false,
                materialize: true,
                start_pack_task_id: Some(DEFAULT_FIRST_DOGFOOD_TASK_ID.to_owned()),
                allow_worker_start: true,
            },
            |service, start| {
                launch_count += 1;
                fake_finish_runner(service, start, "completed")
            },
        )
        .expect("default selected start evidence");

        assert_eq!(launch_count, 1);
        assert_eq!(evidence.operator_context.used_direct_database_path, false);
        let selected = evidence.selected_task.expect("selected task");
        assert_eq!(selected.launch_status, "launched");
        assert!(selected.run_link_id.is_some());
        assert_eq!(selected.created_widget_run, false);
        assert_eq!(selected.used_widget_identity, false);
        assert_eq!(selected.scheduler_autodispatch, false);
        assert_eq!(selected.dependent_tasks_auto_started, false);
        assert_eq!(selected.fake_worker_used, true);
        assert_eq!(selected.real_codex_invoked, false);
        assert_eq!(selected.completion_status.as_deref(), Some("completed"));
        assert_eq!(evidence.real_dogfood_run_performed, false);

        let store = SqliteStore::open(app_data_dir.join("hobit.sqlite3")).expect("open store");
        assert!(store
            .list_widget_runs_for_widget(hobit_app::QUEUE_LOCAL_BACKEND_EXECUTION_TARGET_ID)
            .expect("widget runs")
            .is_empty());
        remove_test_app_data_dir(&app_data_dir);
    }

    #[test]
    fn dogfood_operator_default_context_endpoint_unavailable_is_explicit() {
        let app_data_dir = unique_test_app_data_dir();
        fs::write(&app_data_dir, b"not a directory").expect("write blocking file");

        let error = run_dogfood_operator_with_runner(
            DogfoodOperatorRunInput {
                database_path: None,
                app_data_dir: Some(app_data_dir.clone()),
                workspace_id: None,
                workspace_root: Some(repo_root_for_test()),
                pack_path: DOGFOOD_PACK.to_owned(),
                preview: true,
                materialize: false,
                start_pack_task_id: None,
                allow_worker_start: false,
            },
            panic_runner,
        )
        .expect_err("app context should fail clearly");

        assert!(error.contains(APP_BACKEND_ENDPOINT_UNAVAILABLE));
        remove_test_app_data_dir(&app_data_dir);
    }

    #[test]
    fn dogfood_operator_preview_adapter_uses_backend_file_preview_without_queue_mutation() {
        let (db_path, workspace_id) = test_workspace("Dogfood operator preview");
        let service = workspace_service(&db_path).expect("service");
        assert!(service
            .list_agent_queue_tasks(&workspace_id)
            .expect("list tasks")
            .is_empty());

        let evidence = run_dogfood_operator_with_runner(
            input(&db_path, &workspace_id, true, false, None, false),
            panic_runner,
        )
        .expect("preview evidence");

        let preview = evidence.preview.expect("preview");
        assert_eq!(preview.pack_id, "hobit-queue-dogfood-next");
        assert_eq!(preview.task_count, 5);
        assert_eq!(preview.dependency_count, 4);
        assert_eq!(preview.would_start_workers, false);
        assert_eq!(preview.would_create_run_links, false);
        assert_eq!(preview.would_mutate_queue, false);
        assert!(service
            .list_agent_queue_tasks(&workspace_id)
            .expect("list tasks after preview")
            .is_empty());
        remove_test_db_files(&db_path);
    }

    #[test]
    fn dogfood_operator_direct_database_mode_is_explicit_diagnostic_only() {
        let (db_path, workspace_id) = test_workspace("Dogfood diagnostic db");

        let evidence = run_dogfood_operator_with_runner(
            input(&db_path, &workspace_id, true, false, None, false),
            panic_runner,
        )
        .expect("diagnostic preview evidence");

        assert_eq!(
            evidence.operator_context.context_source,
            "diagnostic_direct_database"
        );
        assert_eq!(evidence.operator_context.used_direct_database_path, true);
        assert!(evidence.operator_context.database_path.is_some());
        assert!(evidence.database_path.is_some());
        remove_test_db_files(&db_path);
    }

    #[test]
    fn dogfood_operator_materialize_adapter_reuses_backend_mapping_without_runs() {
        let (db_path, workspace_id) = test_workspace("Dogfood operator materialize");

        let created = run_dogfood_operator_with_runner(
            input(&db_path, &workspace_id, false, true, None, false),
            panic_runner,
        )
        .expect("created evidence");
        let reused = run_dogfood_operator_with_runner(
            input(&db_path, &workspace_id, false, true, None, false),
            panic_runner,
        )
        .expect("reused evidence");

        let created_materialization = created.materialization.expect("created materialization");
        let reused_materialization = reused.materialization.expect("reused materialization");
        assert_eq!(created_materialization.materialization_status, "created");
        assert_eq!(created_materialization.created_count, 5);
        assert_eq!(reused_materialization.materialization_status, "reused");
        assert_eq!(reused_materialization.reused_count, 5);
        assert_eq!(
            queue_task_id(&created_materialization, DEFAULT_FIRST_DOGFOOD_TASK_ID),
            queue_task_id(&reused_materialization, DEFAULT_FIRST_DOGFOOD_TASK_ID)
        );
        assert_eq!(created.boundaries.widget_runs_created, false);
        assert_no_widget_runs_or_links_for_materialized(
            &db_path,
            &workspace_id,
            &created_materialization,
        );
        remove_test_db_files(&db_path);
    }

    #[test]
    fn dogfood_operator_selected_task_adapter_starts_generated_task_with_fake_runner() {
        let (db_path, workspace_id) = test_workspace("Dogfood operator selected task");
        let mut launch_count = 0usize;

        let evidence = run_dogfood_operator_with_runner(
            input(
                &db_path,
                &workspace_id,
                false,
                true,
                Some(DEFAULT_FIRST_DOGFOOD_TASK_ID),
                true,
            ),
            |service, start| {
                launch_count += 1;
                fake_finish_runner(service, start, "completed")
            },
        )
        .expect("selected start evidence");

        assert_eq!(launch_count, 1);
        let selected = evidence.selected_task.expect("selected task");
        assert_eq!(
            selected.selected_pack_task_id,
            DEFAULT_FIRST_DOGFOOD_TASK_ID
        );
        assert_eq!(selected.launch_status, "launched");
        assert!(selected.run_link_id.is_some());
        assert_eq!(selected.created_run_link, true);
        assert_eq!(selected.created_widget_run, false);
        assert_eq!(selected.used_workflow_slot, false);
        assert_eq!(selected.used_widget_identity, false);
        assert_eq!(selected.fake_worker_used, true);
        assert_eq!(selected.real_codex_invoked, false);
        assert_eq!(selected.completion_status.as_deref(), Some("completed"));
        assert_eq!(
            selected.terminal_queue_task_status.as_deref(),
            Some("completed")
        );
        assert_eq!(selected.scheduler_autodispatch, false);
        assert_eq!(selected.dependent_tasks_auto_started, false);
        assert_eq!(evidence.real_dogfood_run_performed, false);

        let store = SqliteStore::open(&db_path).expect("open store");
        assert!(store
            .list_widget_runs_for_widget(hobit_app::QUEUE_LOCAL_BACKEND_EXECUTION_TARGET_ID)
            .expect("widget runs")
            .is_empty());
        remove_test_db_files(&db_path);
    }

    #[test]
    fn dogfood_operator_guards_start_without_real_worker_allowance() {
        let (db_path, workspace_id) = test_workspace("Dogfood operator guard");
        let error = run_dogfood_operator_with_runner(
            input(
                &db_path,
                &workspace_id,
                false,
                true,
                Some(DEFAULT_FIRST_DOGFOOD_TASK_ID),
                false,
            ),
            panic_runner,
        )
        .expect_err("start should be rejected");
        assert!(error.contains("--allow-real-worker"));

        let service = workspace_service(&db_path).expect("service");
        assert!(service
            .list_agent_queue_tasks(&workspace_id)
            .expect("list tasks")
            .is_empty());
        remove_test_db_files(&db_path);
    }

    #[test]
    fn dogfood_operator_rejects_unknown_pack_task_and_start_before_materialize() {
        let (db_path, workspace_id) = test_workspace("Dogfood operator unknown task");

        let before_materialize = run_dogfood_operator_with_runner(
            input(
                &db_path,
                &workspace_id,
                true,
                false,
                Some(DEFAULT_FIRST_DOGFOOD_TASK_ID),
                true,
            ),
            panic_runner,
        )
        .expect_err("start before materialize rejected");
        assert!(before_materialize.contains("materialization is required"));

        let unknown = run_dogfood_operator_with_runner(
            input(
                &db_path,
                &workspace_id,
                false,
                true,
                Some("missing-task"),
                true,
            ),
            panic_runner,
        )
        .expect_err("unknown task rejected");
        assert!(unknown.contains("pack task id was not materialized"));
        remove_test_db_files(&db_path);
    }

    #[test]
    fn dogfood_operator_blocks_dependency_task_and_does_not_autostart_dependents() {
        let (db_path, workspace_id) = test_workspace("Dogfood operator dependency");

        let blocked = run_dogfood_operator_with_runner(
            input(
                &db_path,
                &workspace_id,
                false,
                true,
                Some("dogfood-file-import-hardening"),
                true,
            ),
            panic_runner,
        )
        .expect("blocked dependent evidence");
        let selected = blocked.selected_task.expect("blocked selected");
        assert_eq!(selected.launch_status, "blocked");
        assert_eq!(selected.blocker_code.as_deref(), Some("dependency_waiting"));
        assert_eq!(selected.would_start_workers, false);

        let upstream = run_dogfood_operator_with_runner(
            input(
                &db_path,
                &workspace_id,
                false,
                true,
                Some(DEFAULT_FIRST_DOGFOOD_TASK_ID),
                true,
            ),
            |service, start| fake_finish_runner(service, start, "completed"),
        )
        .expect("upstream evidence");
        let selected_upstream = upstream.selected_task.expect("upstream selected");
        assert_eq!(selected_upstream.launch_status, "launched");

        let materialization = upstream.materialization.expect("materialization");
        let dependent_queue_task_id =
            queue_task_id(&materialization, "dogfood-file-import-hardening");
        let service = workspace_service(&db_path).expect("service");
        assert!(service
            .list_agent_queue_task_run_links(&workspace_id, &dependent_queue_task_id)
            .expect("dependent links")
            .is_empty());
        remove_test_db_files(&db_path);
    }

    #[test]
    fn dogfood_operator_evidence_json_contains_run_ids_without_claiming_real_run_in_fake_mode() {
        let (db_path, workspace_id) = test_workspace("Dogfood operator JSON");
        let evidence = run_dogfood_operator_with_runner(
            input(
                &db_path,
                &workspace_id,
                true,
                true,
                Some(DEFAULT_FIRST_DOGFOOD_TASK_ID),
                true,
            ),
            |service, start| fake_finish_runner(service, start, "completed"),
        )
        .expect("evidence");

        let value: Value = serde_json::to_value(&evidence).expect("serialize evidence");
        assert!(value["preview"]["packSpecHash"].as_str().is_some());
        assert_eq!(value["materialization"]["materializationStatus"], "created");
        assert!(value["selectedTask"]["selectedQueueTaskId"]
            .as_str()
            .is_some());
        assert!(value["selectedTask"]["runLinkId"].as_str().is_some());
        assert_eq!(value["selectedTask"]["realCodexInvoked"], false);
        assert_eq!(value["realDogfoodRunPerformed"], false);
        remove_test_db_files(&db_path);
    }

    fn input(
        db_path: &Path,
        workspace_id: &str,
        preview: bool,
        materialize: bool,
        start_pack_task_id: Option<&str>,
        allow_worker_start: bool,
    ) -> DogfoodOperatorRunInput {
        DogfoodOperatorRunInput {
            database_path: Some(db_path.to_path_buf()),
            app_data_dir: None,
            workspace_id: Some(workspace_id.to_owned()),
            workspace_root: None,
            pack_path: DOGFOOD_PACK.to_owned(),
            preview,
            materialize,
            start_pack_task_id: start_pack_task_id.map(str::to_owned),
            allow_worker_start,
        }
    }

    fn test_workspace(title: &str) -> (PathBuf, String) {
        let db_path = unique_test_db_path();
        let store = SqliteStore::open(&db_path).expect("open store");
        store.init_schema().expect("init schema");
        let service = WorkspaceService::new(store);
        let workspace = service
            .create_empty_workspace_with_root_path(
                title,
                None,
                Some(repo_root_for_test().display().to_string()),
            )
            .expect("create workspace");
        service
            .enable_agent_queue_manual_control(
                workspace.id.clone(),
                Some("dogfood-operator-test".to_owned()),
                Some("dogfood operator fixture".to_owned()),
                None,
            )
            .expect("enable manual control");
        (db_path, workspace.id)
    }

    fn fake_finish_runner(
        service: &WorkspaceService,
        start: &SelectedAgentQueueTaskLocalStartSummary,
        direct_work_status: &str,
    ) -> Result<DogfoodOperatorWorkerOutcome, String> {
        let run_id = start
            .run_id
            .clone()
            .ok_or_else(|| "fake runner missing run id".to_owned())?;
        let task = service
            .finish_assigned_agent_queue_task_run(FinishAssignedAgentQueueTaskRunInput {
                workspace_id: start.workspace_id.clone(),
                queue_item_id: start.queue_item_id.clone(),
                executor_widget_instance_id: start.executor_widget_instance_id.clone(),
                run_id,
                direct_work_status: direct_work_status.to_owned(),
            })
            .map_err(|error| error.to_string())?;
        Ok(DogfoodOperatorWorkerOutcome {
            worker_mode: "fake_headless".to_owned(),
            fake_worker_used: true,
            real_codex_invoked: false,
            completion_status: Some(direct_work_status.to_owned()),
            terminal_queue_task_status: Some(task.status),
            worker_exit_code: None,
            worker_stdout_tail: None,
            worker_stderr_tail: None,
            worker_error_message: None,
        })
    }

    fn panic_runner(
        _service: &WorkspaceService,
        _start: &SelectedAgentQueueTaskLocalStartSummary,
    ) -> Result<DogfoodOperatorWorkerOutcome, String> {
        panic!("runner should not be called")
    }

    fn queue_task_id(
        materialization: &DogfoodOperatorMaterializationEvidence,
        pack_task_id: &str,
    ) -> String {
        materialization
            .mappings
            .iter()
            .find(|mapping| mapping.pack_task_id == pack_task_id)
            .and_then(|mapping| mapping.queue_task_id.clone())
            .unwrap_or_else(|| panic!("missing queue task id for {pack_task_id}"))
    }

    fn assert_no_widget_runs_or_links_for_materialized(
        db_path: &Path,
        workspace_id: &str,
        materialization: &DogfoodOperatorMaterializationEvidence,
    ) {
        let store = SqliteStore::open(db_path).expect("open store");
        assert!(store
            .list_widget_runs_for_widget(hobit_app::QUEUE_LOCAL_BACKEND_EXECUTION_TARGET_ID)
            .expect("widget runs")
            .is_empty());
        for mapping in &materialization.mappings {
            let queue_task_id = mapping.queue_task_id.as_deref().expect("queue task id");
            assert!(store
                .list_agent_queue_task_run_links(workspace_id, queue_task_id)
                .expect("run links")
                .is_empty());
        }
    }

    #[allow(dead_code)]
    fn accept_task_for_dependency(
        service: &WorkspaceService,
        workspace_id: &str,
        queue_item_id: &str,
        run_id: &str,
    ) {
        let evidence = service
            .record_agent_queue_worker_finished(RecordAgentQueueWorkerFinishedInput {
                workspace_id: workspace_id.to_owned(),
                queue_item_id: queue_item_id.to_owned(),
                run_id: run_id.to_owned(),
                outcome: "completed".to_owned(),
                summary: Some("dogfood operator worker finished".to_owned()),
                changed_files: vec![],
                changed_files_summary: None,
                validation_summary: Some("validation not run".to_owned()),
                error_summary: None,
                worker_id: Some("dogfood-operator".to_owned()),
                source: Some("dogfood_operator".to_owned()),
                metadata_json: None,
                finished_at: Some("completed-at".to_owned()),
            })
            .expect("record evidence");
        let review = service
            .create_agent_queue_review_message(hobit_app::CreateAgentQueueReviewMessageInput {
                workspace_id: workspace_id.to_owned(),
                queue_item_id: queue_item_id.to_owned(),
                actor_id: "dogfood-operator".to_owned(),
                message_body: None,
                run_id: Some(run_id.to_owned()),
                evidence_bundle_id: Some(evidence.bundle_id),
            })
            .expect("create review");
        let message_id = review.message_id.expect("message id");
        service
            .ack_agent_queue_review_message(hobit_app::AckAgentQueueReviewMessageInput {
                workspace_id: workspace_id.to_owned(),
                queue_item_id: queue_item_id.to_owned(),
                message_id: message_id.clone(),
                actor_id: "dogfood-operator".to_owned(),
            })
            .expect("ack review");
        service
            .mark_agent_queue_item_done(MarkAgentQueueItemDoneInput {
                workspace_id: workspace_id.to_owned(),
                queue_item_id: queue_item_id.to_owned(),
                actor_id: "dogfood-operator".to_owned(),
                confirmation_token: hobit_app::AGENT_QUEUE_ACCEPTED_COMPLETION_CONFIRMATION_TOKEN
                    .to_owned(),
                reason: Some("accepted by dogfood operator test".to_owned()),
                run_id: Some(run_id.to_owned()),
                review_message_id: Some(message_id),
            })
            .expect("mark done");
    }

    fn repo_root_for_test() -> PathBuf {
        let mut current = std::env::current_dir().expect("current dir");
        loop {
            if current.join("AGENTS.md").is_file() && current.join("Cargo.toml").is_file() {
                return current;
            }
            current = current
                .parent()
                .unwrap_or_else(|| panic!("repo root not found from current dir"))
                .to_path_buf();
        }
    }

    fn unique_test_app_data_dir() -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        env::temp_dir().join(format!(
            "hobit-dogfood-app-context-{}-{nanos}",
            std::process::id()
        ))
    }

    fn unique_test_db_path() -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        env::temp_dir().join(format!(
            "hobit-dogfood-operator-{}-{nanos}.sqlite3",
            std::process::id()
        ))
    }

    fn remove_test_app_data_dir(path: &Path) {
        if path.is_dir() {
            let _ = fs::remove_dir_all(path);
        } else {
            let _ = fs::remove_file(path);
        }
    }

    fn remove_test_db_files(db_path: &Path) {
        let _ = fs::remove_file(db_path);
        let _ = fs::remove_file(db_path.with_extension("sqlite3-wal"));
        let _ = fs::remove_file(db_path.with_extension("sqlite3-shm"));
    }
}
