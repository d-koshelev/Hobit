use serde_json::json;

use crate::WorkspaceServiceError;

use super::{
    direct_work::{
        append_direct_work_log, can_initiate_direct_work, CODEX_DIRECT_WORK_COMMAND_KIND,
        CODEX_DIRECT_WORK_MODE,
    },
    validation::{required_input, validate_widget_run_ownership},
    CancelCodexDirectWorkRunInput, CodexDirectWorkCancellationSummary,
    CodexDirectWorkForceKillSummary, ForceKillCodexDirectWorkRunInput, WorkspaceService,
    WIDGET_LOG_INFO_LEVEL,
};

const DIRECT_WORK_CANCELLATION_ACTIVE_STATUS: &str = "active";
const DIRECT_WORK_CANCELLATION_REQUESTED_STATUS: &str = "cancellation_requested";
const DIRECT_WORK_CANCELLATION_ALREADY_FINISHED_STATUS: &str = "already_finished";
const DIRECT_WORK_FORCE_KILL_REQUESTED_STATUS: &str = "force_kill_requested";
const DIRECT_WORK_CANCELLATION_NOT_FOUND_STATUS: &str = "not_found";

impl WorkspaceService {
    pub fn inspect_codex_direct_work_cancellation(
        &self,
        input: CancelCodexDirectWorkRunInput,
    ) -> Result<CodexDirectWorkCancellationSummary, WorkspaceServiceError> {
        let input = normalize_cancel_direct_work_input(input)?;

        let Some((_workspace, _workbench, widget, run)) = validate_widget_run_ownership(
            &self.store,
            &input.workspace_id,
            &input.workbench_id,
            &input.widget_instance_id,
            &input.run_id,
        )?
        else {
            return Ok(not_found_summary(&input.run_id));
        };

        if !can_initiate_direct_work(&widget.definition_id)
            || run.command_kind.as_deref() != Some(CODEX_DIRECT_WORK_COMMAND_KIND)
        {
            return Ok(not_found_summary(&input.run_id));
        }

        if run.status == "running" {
            return Ok(CodexDirectWorkCancellationSummary {
                run_id: input.run_id,
                status: DIRECT_WORK_CANCELLATION_ACTIVE_STATUS.to_owned(),
                message: "Direct Work run is active".to_owned(),
                cancellation_requested: false,
            });
        }

        Ok(CodexDirectWorkCancellationSummary {
            run_id: input.run_id,
            status: DIRECT_WORK_CANCELLATION_ALREADY_FINISHED_STATUS.to_owned(),
            message: format!(
                "Direct Work run is already finished with status {}",
                run.status
            ),
            cancellation_requested: false,
        })
    }

    pub fn record_codex_direct_work_cancellation_requested(
        &self,
        input: CancelCodexDirectWorkRunInput,
    ) -> Result<CodexDirectWorkCancellationSummary, WorkspaceServiceError> {
        let input = normalize_cancel_direct_work_input(input)?;

        self.store
            .with_immediate_transaction(|store| {
                let Some((workspace, _workbench, widget, run)) = validate_widget_run_ownership(
                    store,
                    &input.workspace_id,
                    &input.workbench_id,
                    &input.widget_instance_id,
                    &input.run_id,
                )?
                else {
                    return Ok(not_found_summary(&input.run_id));
                };

                if !can_initiate_direct_work(&widget.definition_id)
                    || run.command_kind.as_deref() != Some(CODEX_DIRECT_WORK_COMMAND_KIND)
                {
                    return Ok(not_found_summary(&input.run_id));
                }

                if run.status != "running" {
                    return Ok(CodexDirectWorkCancellationSummary {
                        run_id: input.run_id.clone(),
                        status: DIRECT_WORK_CANCELLATION_ALREADY_FINISHED_STATUS.to_owned(),
                        message: format!(
                            "Direct Work run is already finished with status {}",
                            run.status
                        ),
                        cancellation_requested: false,
                    });
                }

                append_direct_work_log(
                    store,
                    &widget.id,
                    Some(&run.id),
                    WIDGET_LOG_INFO_LEVEL,
                    "Direct Work cancellation requested",
                    Some(&direct_work_cancellation_requested_payload(&run.id)),
                )?;
                store.touch_workspace(&workspace.id)?;

                Ok(CodexDirectWorkCancellationSummary {
                    run_id: run.id,
                    status: DIRECT_WORK_CANCELLATION_REQUESTED_STATUS.to_owned(),
                    message: "Direct Work cancellation requested".to_owned(),
                    cancellation_requested: true,
                })
            })
            .map_err(WorkspaceServiceError::from)
    }

    pub fn inspect_codex_direct_work_force_kill(
        &self,
        input: ForceKillCodexDirectWorkRunInput,
    ) -> Result<CodexDirectWorkForceKillSummary, WorkspaceServiceError> {
        let input = normalize_force_kill_direct_work_input(input)?;

        let Some((_workspace, _workbench, widget, run)) = validate_widget_run_ownership(
            &self.store,
            &input.workspace_id,
            &input.workbench_id,
            &input.widget_instance_id,
            &input.run_id,
        )?
        else {
            return Ok(force_kill_not_found_summary(&input.run_id));
        };

        if !can_initiate_direct_work(&widget.definition_id)
            || run.command_kind.as_deref() != Some(CODEX_DIRECT_WORK_COMMAND_KIND)
        {
            return Ok(force_kill_not_found_summary(&input.run_id));
        }

        if run.status == "running" {
            return Ok(CodexDirectWorkForceKillSummary {
                run_id: input.run_id,
                status: DIRECT_WORK_CANCELLATION_ACTIVE_STATUS.to_owned(),
                message: "Direct Work run is active".to_owned(),
                force_kill_requested: false,
            });
        }

        Ok(CodexDirectWorkForceKillSummary {
            run_id: input.run_id,
            status: DIRECT_WORK_CANCELLATION_ALREADY_FINISHED_STATUS.to_owned(),
            message: format!(
                "Direct Work run is already finished with status {}",
                run.status
            ),
            force_kill_requested: false,
        })
    }

    pub fn record_codex_direct_work_force_kill_requested(
        &self,
        input: ForceKillCodexDirectWorkRunInput,
    ) -> Result<CodexDirectWorkForceKillSummary, WorkspaceServiceError> {
        let input = normalize_force_kill_direct_work_input(input)?;

        self.store
            .with_immediate_transaction(|store| {
                let Some((workspace, _workbench, widget, run)) = validate_widget_run_ownership(
                    store,
                    &input.workspace_id,
                    &input.workbench_id,
                    &input.widget_instance_id,
                    &input.run_id,
                )?
                else {
                    return Ok(force_kill_not_found_summary(&input.run_id));
                };

                if !can_initiate_direct_work(&widget.definition_id)
                    || run.command_kind.as_deref() != Some(CODEX_DIRECT_WORK_COMMAND_KIND)
                {
                    return Ok(force_kill_not_found_summary(&input.run_id));
                }

                if run.status != "running" {
                    return Ok(CodexDirectWorkForceKillSummary {
                        run_id: input.run_id.clone(),
                        status: DIRECT_WORK_CANCELLATION_ALREADY_FINISHED_STATUS.to_owned(),
                        message: format!(
                            "Direct Work run is already finished with status {}",
                            run.status
                        ),
                        force_kill_requested: false,
                    });
                }

                append_direct_work_log(
                    store,
                    &widget.id,
                    Some(&run.id),
                    WIDGET_LOG_INFO_LEVEL,
                    "Direct Work force kill requested",
                    Some(&direct_work_force_kill_requested_payload(&run.id)),
                )?;
                store.touch_workspace(&workspace.id)?;

                Ok(CodexDirectWorkForceKillSummary {
                    run_id: run.id,
                    status: DIRECT_WORK_FORCE_KILL_REQUESTED_STATUS.to_owned(),
                    message: "Direct Work force kill requested".to_owned(),
                    force_kill_requested: true,
                })
            })
            .map_err(WorkspaceServiceError::from)
    }
}

fn normalize_cancel_direct_work_input(
    input: CancelCodexDirectWorkRunInput,
) -> Result<CancelCodexDirectWorkRunInput, WorkspaceServiceError> {
    Ok(CancelCodexDirectWorkRunInput {
        workspace_id: required_input(&input.workspace_id, "workspace id")?.to_owned(),
        workbench_id: required_input(&input.workbench_id, "workbench id")?.to_owned(),
        widget_instance_id: required_input(&input.widget_instance_id, "widget instance id")?
            .to_owned(),
        run_id: required_input(&input.run_id, "run id")?.to_owned(),
    })
}

fn normalize_force_kill_direct_work_input(
    input: ForceKillCodexDirectWorkRunInput,
) -> Result<ForceKillCodexDirectWorkRunInput, WorkspaceServiceError> {
    Ok(ForceKillCodexDirectWorkRunInput {
        workspace_id: required_input(&input.workspace_id, "workspace id")?.to_owned(),
        workbench_id: required_input(&input.workbench_id, "workbench id")?.to_owned(),
        widget_instance_id: required_input(&input.widget_instance_id, "widget instance id")?
            .to_owned(),
        run_id: required_input(&input.run_id, "run id")?.to_owned(),
    })
}

fn not_found_summary(run_id: &str) -> CodexDirectWorkCancellationSummary {
    CodexDirectWorkCancellationSummary {
        run_id: run_id.to_owned(),
        status: DIRECT_WORK_CANCELLATION_NOT_FOUND_STATUS.to_owned(),
        message: "Direct Work run was not found for this workspace, workbench, and widget"
            .to_owned(),
        cancellation_requested: false,
    }
}

fn force_kill_not_found_summary(run_id: &str) -> CodexDirectWorkForceKillSummary {
    CodexDirectWorkForceKillSummary {
        run_id: run_id.to_owned(),
        status: DIRECT_WORK_CANCELLATION_NOT_FOUND_STATUS.to_owned(),
        message: "Direct Work run was not found for this workspace, workbench, and widget"
            .to_owned(),
        force_kill_requested: false,
    }
}

fn direct_work_cancellation_requested_payload(run_id: &str) -> String {
    json!({
        "run_id": run_id,
        "mode": CODEX_DIRECT_WORK_MODE,
        "cancellation_requested": true,
        "no_auto_commit": true,
        "no_auto_push": true,
        "git_mutations_performed_by_hobit": false,
    })
    .to_string()
}

fn direct_work_force_kill_requested_payload(run_id: &str) -> String {
    json!({
        "run_id": run_id,
        "mode": CODEX_DIRECT_WORK_MODE,
        "force_kill_requested": true,
        "files_already_written_are_not_rolled_back": true,
        "check_git_status_after_kill": true,
        "no_auto_commit": true,
        "no_auto_push": true,
        "git_mutations_performed_by_hobit": false,
    })
    .to_string()
}
