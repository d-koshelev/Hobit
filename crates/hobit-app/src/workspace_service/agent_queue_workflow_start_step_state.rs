use hobit_storage_sqlite::AgentQueueWorkflowRunReportUpdate;
use serde_json::{json, Map, Value};

use crate::WorkspaceServiceError;

use super::{
    agent_queue_tasks::map_storage_agent_queue_task_error,
    agent_queue_workflow::{
        canonical_json_string, QueueWorkflowAction, QueueWorkflowCommandBlocker,
        QueueWorkflowConflict, QueueWorkflowRun, QueueWorkflowRunStatus, QueueWorkflowStartRequest,
        QueueWorkflowStartStatus,
    },
    agent_queue_workflow_start_step_projection::{
        action_slot, empty_actions, queue_control_snapshot, run_ids_by_slot, scoped_task_ids,
        slot_bindings_json, slot_bindings_value, success_start_step_result, task_ids_by_slot,
        task_ids_by_slot_value,
    },
    agent_queue_workflow_start_step_support::{
        blocker, start_worker_idempotency_key, NormalizedCreateSetupStartStepRequest,
        AWAITING_WORKER_REASON, AWAITING_WORKER_STEP, CREATE_SETUP_START_BLOCKED_STEP,
        DOWNSTREAM_SLOT, START_BLOCKED_STEP, START_PHASE, START_REQUESTED_STEP, START_TRANSITION,
        UPSTREAM_SLOT,
    },
    agent_queue_workflow_start_step_types::{
        QueueWorkflowCreateSetupStartActionSnapshots,
        QueueWorkflowCreateSetupStartDownstreamVerification,
        QueueWorkflowCreateSetupStartStepResult, QueueWorkflowCreateSetupStartStepResultStatus,
        QueueWorkflowCreateSetupStartStepTransition,
    },
    placeholder_timestamp, AgentQueueTaskSummary, WorkspaceService,
};

pub(super) enum StartStepRunResolution {
    Ready(QueueWorkflowRun, Option<QueueWorkflowStartStatus>),
    Conflict(QueueWorkflowRun, QueueWorkflowConflict),
    Invalid(QueueWorkflowCommandBlocker),
}

impl WorkspaceService {
    pub(super) fn start_or_load_workflow_for_start_step(
        &self,
        request: &NormalizedCreateSetupStartStepRequest,
    ) -> Result<StartStepRunResolution, WorkspaceServiceError> {
        if let Some(workflow_run_id) = request.workflow_run_id.as_deref() {
            let Some(run) = self
                .store
                .get_agent_queue_workflow_run(&request.workspace_id, workflow_run_id)?
            else {
                return Ok(StartStepRunResolution::Invalid(blocker(
                    "workflow_run_not_found",
                    "Queue workflow run was not found.",
                    Some("workflowRunId"),
                )));
            };
            if run.workflow_id != request.workflow_id || run.request_id != request.request_id {
                return Ok(StartStepRunResolution::Invalid(blocker(
                    "workflow_run_request_mismatch",
                    "Queue workflow run does not match the typed workflow request.",
                    Some("workflowRunId"),
                )));
            }
            return Ok(StartStepRunResolution::Ready(
                QueueWorkflowRun::from(run),
                None,
            ));
        }

        let started = self.start_queue_workflow(QueueWorkflowStartRequest {
            workspace_id: request.workspace_id.clone(),
            workflow_id: request.workflow_id.clone(),
            request_id: request.request_id.clone(),
            phase: Some(START_PHASE.to_owned()),
            current_step: Some(START_REQUESTED_STEP.to_owned()),
            actor_id: Some(request.actor_id.clone()),
            inputs_snapshot: Some(request.inputs.clone()),
            grant_summary: request.grant_summary.clone(),
            variables: Some(json!({
                "requestId": request.request_id,
                "workflowId": request.workflow_id,
            })),
            slot_bindings: Some(json!({})),
            mutation_refs: Some(json!({})),
            idempotency_keys: Some(json!([])),
            action_log_summary: Some(json!([])),
        })?;
        match started.status {
            QueueWorkflowStartStatus::Succeeded | QueueWorkflowStartStatus::AlreadyExists => {
                let run = started.workflow_run.ok_or_else(|| {
                    WorkspaceServiceError::InvalidInput(
                        "Queue workflow start did not return a workflow run.".to_owned(),
                    )
                })?;
                Ok(StartStepRunResolution::Ready(run, Some(started.status)))
            }
            QueueWorkflowStartStatus::Conflict => {
                let run = started.workflow_run.ok_or_else(|| {
                    WorkspaceServiceError::InvalidInput(
                        "Queue workflow conflict did not return existing run.".to_owned(),
                    )
                })?;
                Ok(StartStepRunResolution::Conflict(
                    run,
                    started.conflict.unwrap_or(QueueWorkflowConflict {
                        conflict_code: "request_id_hash_conflict".to_owned(),
                        conflict_message: "Queue workflow request hash conflict.".to_owned(),
                        existing_workflow_run_id: None,
                        existing_request_hash: None,
                        requested_request_hash: None,
                    }),
                ))
            }
            QueueWorkflowStartStatus::InvalidInput => Ok(StartStepRunResolution::Invalid(
                started.blocker.unwrap_or_else(|| {
                    blocker(
                        "invalid_workflow_start",
                        "Queue workflow start failed.",
                        Some("requestId"),
                    )
                }),
            )),
        }
    }

    pub(super) fn blocked_from_substep(
        &self,
        normalized: &NormalizedCreateSetupStartStepRequest,
        workflow_run_id: String,
        actions: QueueWorkflowCreateSetupStartActionSnapshots,
        blocker: Option<QueueWorkflowCommandBlocker>,
        conflict: Option<QueueWorkflowConflict>,
    ) -> Result<QueueWorkflowCreateSetupStartStepResult, WorkspaceServiceError> {
        let run = self.update_start_step_workflow_report(
            normalized,
            &workflow_run_id,
            &AgentQueueTaskSummary {
                queue_item_id: String::new(),
                workspace_id: normalized.workspace_id.clone(),
                title: String::new(),
                description: String::new(),
                prompt: String::new(),
                status: String::new(),
                priority: 0,
                depends_on: Vec::new(),
                execution_policy: "manual".to_owned(),
                execution_workspace: None,
                codex_executable: None,
                sandbox: None,
                approval_policy: None,
                context_json: None,
                assigned_executor_widget_id: None,
                created_at: String::new(),
                updated_at: String::new(),
            },
            None,
            None,
            blocker
                .as_ref()
                .map(|blocker| blocker.blocker_message.clone())
                .or_else(|| {
                    conflict
                        .as_ref()
                        .map(|conflict| conflict.conflict_message.clone())
                }),
            &actions,
        )?;
        Ok(QueueWorkflowCreateSetupStartStepResult {
            workflow_run_id: Some(workflow_run_id),
            request_id: normalized.request_id.clone(),
            workflow_id: normalized.workflow_id.clone(),
            transition: QueueWorkflowCreateSetupStartStepTransition::CreateSetupStart,
            status: if conflict.is_some() {
                QueueWorkflowCreateSetupStartStepResultStatus::Conflict
            } else if blocker
                .as_ref()
                .and_then(|blocker| blocker.missing_required_field.as_deref())
                .is_some()
            {
                QueueWorkflowCreateSetupStartStepResultStatus::InvalidInput
            } else {
                QueueWorkflowCreateSetupStartStepResultStatus::BlockedPrecondition
            },
            actions,
            slot_binding_snapshot: slot_bindings_value(&run),
            task_ids_by_slot: task_ids_by_slot(&run),
            run_ids_by_slot: run_ids_by_slot(&run),
            settings_hash: Some(normalized.settings_hash.clone()),
            execution_target_hash: Some(normalized.execution_target_hash.clone()),
            execution_target_kind: Some(normalized.execution_target_kind.clone()),
            provider_id: Some(normalized.provider_id.clone()),
            workflow_run: Some(run),
            next_phase: Some(START_PHASE.to_owned()),
            next_step: Some(CREATE_SETUP_START_BLOCKED_STEP.to_owned()),
            queue_control: self
                .get_agent_queue_control_state(&normalized.workspace_id)?
                .map(queue_control_snapshot),
            downstream_verification: None,
            blockers: blocker.into_iter().collect(),
            conflict,
            worker_launch_intent: None,
        })
    }

    pub(super) fn workflow_action_by_key(
        &self,
        workflow_run_id: &str,
        idempotency_key: &str,
    ) -> Result<Option<QueueWorkflowAction>, WorkspaceServiceError> {
        Ok(self
            .store
            .get_agent_queue_workflow_action_by_idempotency_key(workflow_run_id, idempotency_key)?
            .map(QueueWorkflowAction::from))
    }

    pub(super) fn update_start_step_workflow_report(
        &self,
        normalized: &NormalizedCreateSetupStartStepRequest,
        workflow_run_id: &str,
        upstream_task: &AgentQueueTaskSummary,
        downstream_task: Option<&AgentQueueTaskSummary>,
        run_id: Option<String>,
        blocker_reason: Option<String>,
        actions: &QueueWorkflowCreateSetupStartActionSnapshots,
    ) -> Result<QueueWorkflowRun, WorkspaceServiceError> {
        let existing = self
            .store
            .get_agent_queue_workflow_run(&normalized.workspace_id, workflow_run_id)?
            .ok_or_else(|| {
                WorkspaceServiceError::InvalidInput("workflow run not found".to_owned())
            })?;
        let mut slot_bindings = slot_bindings_json(existing.slot_bindings_json.as_deref());
        let upstream_binding = slot_bindings
            .entry(UPSTREAM_SLOT.to_owned())
            .or_insert_with(|| Value::Object(Map::new()));
        if let Some(object) = upstream_binding.as_object_mut() {
            if !upstream_task.queue_item_id.is_empty() {
                object.insert(
                    "taskId".to_owned(),
                    Value::String(upstream_task.queue_item_id.clone()),
                );
            }
            object.insert(
                "settingsHash".to_owned(),
                Value::String(normalized.settings_hash.clone()),
            );
            object.insert(
                "executionTargetHash".to_owned(),
                Value::String(normalized.execution_target_hash.clone()),
            );
            object.insert(
                "executionTargetKind".to_owned(),
                Value::String(normalized.execution_target_kind.clone()),
            );
            object.insert(
                "providerId".to_owned(),
                Value::String(normalized.provider_id.clone()),
            );
            object.insert(
                "startWorkerActionIdempotencyKey".to_owned(),
                Value::String(start_worker_idempotency_key(
                    workflow_run_id,
                    &upstream_task.queue_item_id,
                    &normalized.execution_target_hash,
                    &normalized.settings_hash,
                )),
            );
            if let Some(action) = actions.start_worker.as_ref() {
                object.insert(
                    "startWorkerActionId".to_owned(),
                    Value::String(action.action_id.clone()),
                );
            }
            if let Some(run_id) = run_id.as_ref() {
                object.insert("runId".to_owned(), Value::String(run_id.clone()));
            }
        }
        if let Some(downstream_task) = downstream_task {
            let downstream_binding = slot_bindings
                .entry(DOWNSTREAM_SLOT.to_owned())
                .or_insert_with(|| Value::Object(Map::new()));
            if let Some(object) = downstream_binding.as_object_mut() {
                object.insert(
                    "taskId".to_owned(),
                    Value::String(downstream_task.queue_item_id.clone()),
                );
                object.insert("dependsOnSlots".to_owned(), json!([UPSTREAM_SLOT]));
                if !upstream_task.queue_item_id.is_empty() {
                    object.insert(
                        "dependencyTaskIds".to_owned(),
                        json!([upstream_task.queue_item_id]),
                    );
                }
            }
        }
        let slot_bindings_value = Value::Object(slot_bindings);
        let run_ids = if let Some(run_id) = run_id.as_ref() {
            json!({ UPSTREAM_SLOT: run_id })
        } else {
            json!({})
        };
        let variables = json!({
            "requestId": normalized.request_id,
            "runIdsBySlot": run_ids,
            "scopedRunIds": run_id.iter().collect::<Vec<_>>(),
            "scopedTaskIds": scoped_task_ids(upstream_task, downstream_task),
            "slots": slot_bindings_value,
            "taskIdsBySlot": task_ids_by_slot_value(upstream_task, downstream_task),
            "workflowId": normalized.workflow_id,
        });
        let mutation_refs = json!({
            "createSetupStartStatus": if run_id.is_some() { "awaiting_worker_completion" } else { "blocked" },
            "downstreamTaskId": downstream_task.map(|task| task.queue_item_id.as_str()),
            "executionTargetHash": normalized.execution_target_hash,
            "executionTargetKind": normalized.execution_target_kind,
            "settingsHash": normalized.settings_hash,
            "startedRunId": run_id,
            "upstreamTaskId": if upstream_task.queue_item_id.is_empty() { None } else { Some(upstream_task.queue_item_id.as_str()) },
        });
        let idempotency_keys = Value::Array(
            actions
                .idempotency_keys()
                .into_iter()
                .map(Value::String)
                .collect(),
        );
        let action_log_summary = json!({
            "actionCount": actions.action_count(),
            "phase": START_TRANSITION,
            "runnerStatus": if blocker_reason.is_some() { "blocked" } else { "awaiting_worker_completion" },
        });
        let updated_at = placeholder_timestamp();
        let status = if blocker_reason.is_some() {
            QueueWorkflowRunStatus::Blocked.as_str()
        } else {
            QueueWorkflowRunStatus::Paused.as_str()
        };
        let current_step = if blocker_reason.is_some() {
            START_BLOCKED_STEP
        } else {
            AWAITING_WORKER_STEP
        };
        let pause_reason = if blocker_reason.is_none() {
            Some(AWAITING_WORKER_REASON)
        } else {
            None
        };
        let slot_bindings_json = canonical_json_string(&slot_bindings_value);
        let variables_json = canonical_json_string(&variables);
        let mutation_refs_json = canonical_json_string(&mutation_refs);
        let idempotency_keys_json = canonical_json_string(&idempotency_keys);
        let action_log_summary_json = canonical_json_string(&action_log_summary);

        self.store
            .with_immediate_transaction(|store| {
                store
                    .update_agent_queue_workflow_run_report(
                        &normalized.workspace_id,
                        workflow_run_id,
                        AgentQueueWorkflowRunReportUpdate {
                            status,
                            phase: Some(START_PHASE),
                            current_step: Some(current_step),
                            pause_reason,
                            blocker_reason: blocker_reason.as_deref(),
                            variables_json: Some(&variables_json),
                            slot_bindings_json: Some(&slot_bindings_json),
                            mutation_refs_json: Some(&mutation_refs_json),
                            idempotency_keys_json: Some(&idempotency_keys_json),
                            action_log_summary_json: Some(&action_log_summary_json),
                            updated_at: Some(&updated_at),
                            completed_at: None,
                        },
                    )?
                    .ok_or(hobit_storage_sqlite::StorageError::QueryReturnedNoRows)
            })
            .map(QueueWorkflowRun::from)
            .map_err(map_storage_agent_queue_task_error)
    }

    pub(super) fn downstream_verification(
        &self,
        workspace_id: &str,
        downstream_task: Option<&AgentQueueTaskSummary>,
    ) -> Result<Option<QueueWorkflowCreateSetupStartDownstreamVerification>, WorkspaceServiceError>
    {
        let Some(downstream_task) = downstream_task else {
            return Ok(None);
        };
        let latest_link = self
            .get_latest_agent_queue_task_run_link(workspace_id, &downstream_task.queue_item_id)?;
        Ok(Some(QueueWorkflowCreateSetupStartDownstreamVerification {
            downstream_task_id: Some(downstream_task.queue_item_id.clone()),
            downstream_task_exists: true,
            dependency_edge_exists: !downstream_task.depends_on.is_empty(),
            downstream_run_id_absent: latest_link.is_none(),
            downstream_not_started: downstream_task.status != "running",
        }))
    }

    pub(super) fn already_applied_start_step_result(
        &self,
        normalized: NormalizedCreateSetupStartStepRequest,
        workflow_run: QueueWorkflowRun,
    ) -> Result<QueueWorkflowCreateSetupStartStepResult, WorkspaceServiceError> {
        let mut actions = empty_actions();
        for action in self
            .store
            .list_agent_queue_workflow_actions(
                &normalized.workspace_id,
                &workflow_run.workflow_run_id,
            )?
            .into_iter()
            .map(QueueWorkflowAction::from)
        {
            match action.action_type.as_str() {
                "create_task" if action_slot(&action).as_deref() == Some(UPSTREAM_SLOT) => {
                    actions.create_task_upstream = Some(action);
                }
                "create_task" if action_slot(&action).as_deref() == Some(DOWNSTREAM_SLOT) => {
                    actions.create_task_downstream = Some(action);
                }
                "update_run_settings" => actions.update_run_settings = Some(action),
                "promote_task" => actions.promote_task = Some(action),
                "start_worker" => actions.start_worker = Some(action),
                _ => {}
            }
        }
        let downstream_task = task_ids_by_slot(&workflow_run)
            .get(DOWNSTREAM_SLOT)
            .and_then(|task_id| {
                self.get_agent_queue_task(&normalized.workspace_id, task_id)
                    .ok()
                    .flatten()
            });
        let control = self.get_agent_queue_control_state(&normalized.workspace_id)?;
        let downstream_verification =
            self.downstream_verification(&normalized.workspace_id, downstream_task.as_ref())?;
        Ok(success_start_step_result(
            normalized,
            workflow_run,
            actions,
            control,
            downstream_verification,
            true,
        ))
    }
}
