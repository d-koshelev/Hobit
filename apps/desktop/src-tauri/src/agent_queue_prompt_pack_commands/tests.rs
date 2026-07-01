use super::*;

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use hobit_app::{
    AgentQueuePromptPackFileRequest, AgentQueuePromptPackMaterializeRequest,
    AgentQueuePromptPackPreviewRequest, DeleteAgentQueueTaskInput, QueueWorkflowListRequest,
    WorkspaceService, QUEUE_LOCAL_BACKEND_EXECUTION_TARGET_ID,
};
use hobit_storage_sqlite::{
    NewAgentQueuePromptPackMaterialization, NewAgentQueuePromptPackTaskMapping, NewAgentQueueTask,
    SqliteStore,
};
use serde_json::{json, Value};

#[test]
fn prompt_pack_valid_minimal_pack_parses_and_reports_read_only_preview() {
    let result = preview_value(valid_minimal_pack());
    let preview = valid_preview(result);

    assert_eq!(preview.workspace_id, "workspace-1");
    assert_eq!(preview.pack.pack_id, "hobit-queue-dogfood-next");
    assert_eq!(preview.task_count, 1);
    assert_eq!(preview.dependency_count, 0);
    assert_eq!(preview.tasks[0].status, "draft");
    assert_eq!(preview.tasks[0].priority, 3);
    assert!(preview.tasks[0]
        .task_spec_hash
        .starts_with("prompt_pack_task_spec:"));
    assert!(preview.pack_spec_hash.starts_with("prompt_pack_spec:"));
    assert!(preview
        .run_settings_hash
        .starts_with("prompt_pack_run_settings:"));
    assert!(preview
        .dependency_spec_hash
        .starts_with("prompt_pack_dependency_spec:"));
    assert!(!preview.would_start_workers);
    assert!(!preview.would_create_run_links);
    assert!(!preview.would_mutate_queue);
    assert_eq!(preview.materialization_status, "not_evaluated");
    assert!(preview.blockers.is_empty());
}

#[test]
fn prompt_pack_valid_dependencies_run_settings_and_normalization_preview() {
    let mut pack = valid_minimal_pack();
    pack["runSettings"] = json!({
        "executionTarget": {
            "kind": "queue_local",
            "providerId": "codex"
        },
        "executionPolicy": "manual",
        "sandbox": "workspace_write",
        "approvalPolicy": "never"
    });
    pack["tasks"] = json!([
        {
            "id": "task-c",
            "title": "Task C",
            "prompt": "Run C.",
            "tags": ["Beta", "alpha"],
            "priority": 4
        },
        {
            "id": "task-a",
            "title": "Task A",
            "prompt": "Run A."
        },
        {
            "id": "task-b",
            "title": "Task B",
            "prompt": "Run B.",
            "dependsOn": ["task-c", "task-a"]
        }
    ]);

    let preview = valid_preview(preview_value(pack));

    assert_eq!(preview.task_count, 3);
    assert_eq!(preview.dependency_count, 2);
    assert_eq!(
        preview
            .run_settings
            .execution_target
            .as_ref()
            .expect("execution target")
            .kind,
        "queue_local"
    );
    assert_eq!(
        preview
            .run_settings
            .execution_target
            .as_ref()
            .expect("execution target")
            .provider_id,
        "codex"
    );
    assert_eq!(preview.run_settings.execution_policy, "manual");
    assert_eq!(
        preview.run_settings.sandbox.as_deref(),
        Some("workspace_write")
    );
    assert_eq!(
        preview.run_settings.approval_policy.as_deref(),
        Some("never")
    );

    let task_c = task(&preview.tasks, "task-c");
    let task_b = task(&preview.tasks, "task-b");
    assert_eq!(task_c.tags, vec!["alpha".to_owned(), "beta".to_owned()]);
    assert_eq!(
        task_b.depends_on,
        vec!["task-a".to_owned(), "task-c".to_owned()]
    );
}

#[test]
fn prompt_pack_hashes_are_stable_when_task_order_changes() {
    let mut first = valid_minimal_pack();
    first["tasks"] = json!([
        {
            "id": "task-a",
            "title": "Task A",
            "prompt": "Run A.",
            "dependsOn": []
        },
        {
            "id": "task-b",
            "title": "Task B",
            "prompt": "Run B.",
            "dependsOn": ["task-a"]
        }
    ]);

    let mut second = first.clone();
    second["tasks"] = json!([
        {
            "id": "task-b",
            "title": "Task B",
            "prompt": "Run B.",
            "dependsOn": ["task-a"]
        },
        {
            "id": "task-a",
            "title": "Task A",
            "prompt": "Run A.",
            "dependsOn": []
        }
    ]);

    let first = valid_preview(preview_value(first));
    let second = valid_preview(preview_value(second));

    assert_eq!(first.pack_spec_hash, second.pack_spec_hash);
    assert_eq!(first.dependency_spec_hash, second.dependency_spec_hash);
    assert_eq!(first.run_settings_hash, second.run_settings_hash);
    assert_eq!(
        task(&first.tasks, "task-a").task_spec_hash,
        task(&second.tasks, "task-a").task_spec_hash
    );
    assert_eq!(
        task(&first.tasks, "task-b").task_spec_hash,
        task(&second.tasks, "task-b").task_spec_hash
    );
}

#[test]
fn prompt_pack_hashes_change_when_prompt_dependency_or_run_settings_change() {
    let base = valid_preview(preview_value(two_task_pack_with_dependency()));

    let mut prompt_changed = two_task_pack_with_dependency();
    prompt_changed["tasks"][1]["prompt"] = json!("Run B with a changed prompt.");
    let prompt_changed = valid_preview(preview_value(prompt_changed));
    assert_ne!(
        task(&base.tasks, "task-b").task_spec_hash,
        task(&prompt_changed.tasks, "task-b").task_spec_hash
    );
    assert_ne!(base.pack_spec_hash, prompt_changed.pack_spec_hash);

    let mut dependency_changed = two_task_pack_with_dependency();
    dependency_changed["tasks"][1]["dependsOn"] = json!([]);
    let dependency_changed = valid_preview(preview_value(dependency_changed));
    assert_ne!(
        base.dependency_spec_hash,
        dependency_changed.dependency_spec_hash
    );
    assert_ne!(base.pack_spec_hash, dependency_changed.pack_spec_hash);

    let mut run_settings_changed = two_task_pack_with_dependency();
    run_settings_changed["runSettings"] = json!({
        "executionTarget": {
            "kind": "queue_local",
            "providerId": "codex"
        },
        "executionPolicy": "manual",
        "sandbox": "read_only",
        "approvalPolicy": "never"
    });
    let run_settings_changed = valid_preview(preview_value(run_settings_changed));
    assert_ne!(
        base.run_settings_hash,
        run_settings_changed.run_settings_hash
    );
    assert_ne!(base.pack_spec_hash, run_settings_changed.pack_spec_hash);
}

#[test]
fn prompt_pack_invalid_json_and_schema_cases_are_rejected() {
    assert_invalid_payload("{", "invalid_json");
    assert_invalid_value(json!("not an object"), "invalid_json_object");

    let mut unsupported_version = valid_minimal_pack();
    unsupported_version["version"] = json!(2);
    assert_invalid_value(unsupported_version, "unsupported_version");

    let mut missing_pack_id = valid_minimal_pack();
    missing_pack_id
        .as_object_mut()
        .expect("object")
        .remove("packId");
    assert_invalid_value(missing_pack_id, "missing_pack_id");

    let mut malformed_pack_id = valid_minimal_pack();
    malformed_pack_id["packId"] = json!("Bad Pack");
    assert_invalid_value(malformed_pack_id, "malformed_packId");

    let mut missing_task_id = valid_minimal_pack();
    missing_task_id["tasks"][0]
        .as_object_mut()
        .expect("task object")
        .remove("id");
    assert_invalid_value(missing_task_id, "missing_task_id");

    let mut malformed_task_id = valid_minimal_pack();
    malformed_task_id["tasks"][0]["id"] = json!("Bad Task");
    assert_invalid_value(malformed_task_id, "malformed_task_id");

    let mut duplicate_task_ids = valid_minimal_pack();
    duplicate_task_ids["tasks"] = json!([
        {"id": "task-a", "title": "Task A", "prompt": "Run A."},
        {"id": "task-a", "title": "Task A again", "prompt": "Run A again."}
    ]);
    assert_invalid_value(duplicate_task_ids, "duplicate_task_id");

    let mut oversized_title = valid_minimal_pack();
    oversized_title["tasks"][0]["title"] = json!("x".repeat(201));
    assert_invalid_value(oversized_title, "oversized_task_title");

    let mut oversized_prompt = valid_minimal_pack();
    oversized_prompt["tasks"][0]["prompt"] = json!("x".repeat(100_001));
    assert_invalid_value(oversized_prompt, "oversized_prompt");

    let mut too_many_tasks = valid_minimal_pack();
    too_many_tasks["tasks"] = Value::Array(
        (0..101)
            .map(|index| {
                json!({
                    "id": format!("task-{index}"),
                    "title": format!("Task {index}"),
                    "prompt": "Run task."
                })
            })
            .collect(),
    );
    assert_invalid_value(too_many_tasks, "too_many_tasks");

    let mut duplicate_tags = valid_minimal_pack();
    duplicate_tags["tasks"][0]["tags"] = json!(["Bug", "bug"]);
    assert_invalid_value(duplicate_tags, "duplicate_tag");
}

#[test]
fn prompt_pack_invalid_dependency_cases_are_rejected() {
    let mut unknown_dependency = valid_minimal_pack();
    unknown_dependency["tasks"][0]["dependsOn"] = json!(["missing-task"]);
    assert_invalid_value(unknown_dependency, "unknown_dependency");

    let mut duplicate_dependency = two_task_pack_with_dependency();
    duplicate_dependency["tasks"][1]["dependsOn"] = json!(["task-a", "task-a"]);
    assert_invalid_value(duplicate_dependency, "duplicate_dependency");

    let mut self_dependency = valid_minimal_pack();
    self_dependency["tasks"][0]["dependsOn"] = json!(["dogfood-status-checkpoint"]);
    assert_invalid_value(self_dependency, "self_dependency");

    let mut cycle = valid_minimal_pack();
    cycle["tasks"] = json!([
        {
            "id": "task-a",
            "title": "Task A",
            "prompt": "Run A.",
            "dependsOn": ["task-b"]
        },
        {
            "id": "task-b",
            "title": "Task B",
            "prompt": "Run B.",
            "dependsOn": ["task-a"]
        }
    ]);
    assert_invalid_value(cycle, "dependency_cycle");
}

#[test]
fn prompt_pack_security_and_unsupported_fields_are_rejected() {
    let mut unsupported_top_level = valid_minimal_pack();
    unsupported_top_level["batch"] = json!(true);
    assert_invalid_value(unsupported_top_level, "unsupported_field");

    let mut unsupported_task_field = valid_minimal_pack();
    unsupported_task_field["tasks"][0]["materialize"] = json!(true);
    assert_invalid_value(unsupported_task_field, "unsupported_field");

    let mut confirmation_token = valid_minimal_pack();
    confirmation_token["tasks"][0]["safety"] = json!({
        "confirmationToken": "do-not-accept"
    });
    assert_invalid_value(confirmation_token, "confirmation_token_rejected");

    let mut prompt_text_is_not_scanned = valid_minimal_pack();
    prompt_text_is_not_scanned["tasks"][0]["prompt"] =
        json!("This normal prompt text mentions confirmationToken.");
    assert_eq!(
        preview_value(prompt_text_is_not_scanned).status,
        "succeeded"
    );

    let mut workspace_id = valid_minimal_pack();
    workspace_id["workspaceId"] = json!("workspace-from-json");
    assert_invalid_value(workspace_id, "workspace_scope_rejected");

    let mut workspace_root = valid_minimal_pack();
    workspace_root["workspaceRoot"] = json!("C:/repo");
    assert_invalid_value(workspace_root, "workspace_scope_rejected");

    let mut execution_workspace = valid_minimal_pack();
    execution_workspace["runSettings"] = json!({
        "executionWorkspace": "C:/repo"
    });
    assert_invalid_value(execution_workspace, "workspace_scope_rejected");

    let mut command_like_setting = valid_minimal_pack();
    command_like_setting["runSettings"] = json!({
        "codexExecutable": "codex.cmd"
    });
    assert_invalid_value(command_like_setting, "unsupported_field");
}

#[test]
fn prompt_pack_unsupported_execution_settings_are_rejected() {
    let mut unsupported_target = valid_minimal_pack();
    unsupported_target["runSettings"] = json!({
        "executionTarget": {
            "kind": "agent_executor",
            "providerId": "codex"
        },
        "executionPolicy": "manual"
    });
    assert_invalid_value(unsupported_target, "unsupported_execution_target");

    let mut unsupported_provider = valid_minimal_pack();
    unsupported_provider["runSettings"] = json!({
        "executionTarget": {
            "kind": "queue_local",
            "providerId": "other"
        },
        "executionPolicy": "manual"
    });
    assert_invalid_value(unsupported_provider, "unsupported_execution_target");

    let mut unsupported_policy = valid_minimal_pack();
    unsupported_policy["runSettings"] = json!({
        "executionPolicy": "auto"
    });
    assert_invalid_value(unsupported_policy, "unsupported_execution_policy");

    let mut no_auto_run_false = valid_minimal_pack();
    no_auto_run_false["constraints"] = json!({
        "noAutoRun": false
    });
    assert_invalid_value(no_auto_run_false, "auto_run_not_allowed");

    let mut danger_sandbox = valid_minimal_pack();
    danger_sandbox["runSettings"] = json!({
        "executionPolicy": "manual",
        "sandbox": "danger_full_access"
    });
    assert_invalid_value(danger_sandbox, "unsupported_sandbox");
}

#[test]
fn prompt_pack_preview_serializes_with_camel_case_for_tauri() {
    let result = preview_value(valid_minimal_pack());
    let serialized = serde_json::to_value(result).expect("serialize preview");

    assert_eq!(serialized["status"], "succeeded");
    assert!(serialized["preview"]["pack"]["packId"].is_string());
    assert!(serialized["preview"]["packSpecHash"].is_string());
    assert!(serialized["preview"]["runSettingsHash"].is_string());
    assert!(serialized["preview"]["dependencySpecHash"].is_string());
    assert_eq!(serialized["preview"]["wouldStartWorkers"], false);
    assert_eq!(serialized["preview"]["wouldCreateRunLinks"], false);
    assert_eq!(serialized["preview"]["wouldMutateQueue"], false);
}

#[test]
fn prompt_pack_preview_command_does_not_mutate_queue_storage() {
    let db_path = unique_test_db_path();
    let store = SqliteStore::open(&db_path).expect("open store");
    store.init_schema().expect("init schema");
    let service = WorkspaceService::new(store);
    let workspace = service
        .create_empty_workspace("Prompt pack read-only", None)
        .expect("create workspace");
    drop(service);

    let result = preview_agent_queue_prompt_pack_stateful_blocking(
        AgentQueuePromptPackPreviewRequest {
            workspace_id: workspace.id.clone(),
            json_payload: valid_minimal_pack().to_string(),
        },
        db_path.clone(),
    )
    .expect("stateful preview");
    assert_eq!(result.status, "succeeded");
    let preview = result.preview.as_ref().expect("preview");
    assert_eq!(preview.materialization_status, "not_materialized");
    assert!(preview.would_create);
    assert!(!preview.would_mutate_queue);

    let store = SqliteStore::open(&db_path).expect("reopen store");
    let service = WorkspaceService::new(store);
    assert!(service
        .list_agent_queue_tasks(&workspace.id)
        .expect("list tasks")
        .is_empty());
    assert!(service
        .list_queue_workflow_runs(QueueWorkflowListRequest {
            workspace_id: workspace.id.clone(),
            status: None,
            workflow_id: None,
        })
        .expect("list workflows")
        .is_empty());
    drop(service);

    let store = SqliteStore::open(&db_path).expect("reopen store");
    assert!(store
        .list_widget_runs_for_widget("agent-run-widget")
        .expect("list widget runs")
        .is_empty());
    assert!(store
        .list_agent_queue_task_run_links(&workspace.id, "queue-task")
        .expect("list run links")
        .is_empty());
    assert!(store
        .list_agent_queue_workflow_actions(&workspace.id, "workflow-run")
        .expect("list workflow actions")
        .is_empty());

    remove_test_db_files(&db_path);
}

#[test]
fn prompt_pack_materialize_valid_minimal_pack_creates_plain_queue_task() {
    let (db_path, workspace_id) = test_workspace("Prompt pack materialize minimal");

    let result = materialize_value(&db_path, &workspace_id, valid_minimal_pack());

    assert_eq!(result.status, "created");
    assert_eq!(result.pack_id.as_deref(), Some("hobit-queue-dogfood-next"));
    assert!(result
        .pack_spec_hash
        .as_deref()
        .expect("pack hash")
        .starts_with("prompt_pack_spec:"));
    assert!(result
        .run_settings_hash
        .as_deref()
        .expect("run settings hash")
        .starts_with("prompt_pack_run_settings:"));
    assert!(result
        .dependency_spec_hash
        .as_deref()
        .expect("dependency hash")
        .starts_with("prompt_pack_dependency_spec:"));
    assert_eq!(result.task_count, 1);
    assert_eq!(result.created_count, 1);
    assert_eq!(result.reused_count, 0);
    assert_eq!(result.conflict_count, 0);
    assert!(!result.would_start_workers);
    assert!(!result.would_create_run_links);
    assert!(result.would_mutate_queue);
    assert_eq!(result.tasks[0].status, "created");
    assert!(result.tasks[0].queue_task_id.is_some());
    assert!(result.tasks[0]
        .task_spec_hash
        .starts_with("prompt_pack_task_spec:"));

    let service = workspace_service_for_test(&db_path);
    let tasks = service
        .list_agent_queue_tasks(&workspace_id)
        .expect("list queue tasks");
    assert_eq!(tasks.len(), 1);
    assert_eq!(tasks[0].title, "Dogfood status checkpoint");
    assert_eq!(tasks[0].prompt, "Summarize the current dogfood state.");
    assert_eq!(tasks[0].status, "draft");
    assert_eq!(tasks[0].priority, 3);
    assert_eq!(tasks[0].execution_policy, "manual");
    assert_eq!(tasks[0].sandbox, None);
    assert_eq!(tasks[0].approval_policy, None);
    assert_no_runtime_artifacts(&db_path, &workspace_id);

    remove_test_db_files(&db_path);
}

#[test]
fn prompt_pack_materialize_dependencies_remap_to_generated_queue_task_ids() {
    let (db_path, workspace_id) = test_workspace("Prompt pack dependency remap");

    let result = materialize_value(&db_path, &workspace_id, two_task_pack_with_dependency());

    assert_eq!(result.status, "created");
    assert_eq!(result.created_count, 2);
    let task_a = materialized_task(&result.tasks, "task-a");
    let task_b = materialized_task(&result.tasks, "task-b");
    let queue_task_a = task_a.queue_task_id.as_ref().expect("task a queue id");
    let queue_task_b = task_b.queue_task_id.as_ref().expect("task b queue id");
    assert_ne!(queue_task_a, queue_task_b);
    assert_eq!(task_b.dependency_queue_task_ids, vec![queue_task_a.clone()]);

    let store = SqliteStore::open(&db_path).expect("open store");
    let upstream = store
        .get_agent_queue_task(&workspace_id, queue_task_a)
        .expect("get upstream")
        .expect("upstream task");
    let downstream = store
        .get_agent_queue_task(&workspace_id, queue_task_b)
        .expect("get downstream")
        .expect("downstream task");
    assert_eq!(upstream.depends_on, "[]");
    assert_eq!(
        serde_json::from_str::<Vec<String>>(&downstream.depends_on).expect("depends_on json"),
        vec![queue_task_a.clone()]
    );
    assert_eq!(downstream.sandbox.as_deref(), Some("workspace_write"));
    assert_eq!(downstream.approval_policy.as_deref(), Some("never"));
    assert_no_runtime_artifacts(&db_path, &workspace_id);

    remove_test_db_files(&db_path);
}

#[test]
fn prompt_pack_materialize_identical_pack_reuses_existing_queue_tasks() {
    let (db_path, workspace_id) = test_workspace("Prompt pack idempotency");
    let pack = two_task_pack_with_dependency();

    let first = materialize_value(&db_path, &workspace_id, pack.clone());
    let second = materialize_value(&db_path, &workspace_id, pack);

    assert_eq!(first.status, "created");
    assert_eq!(second.status, "reused");
    assert_eq!(second.created_count, 0);
    assert_eq!(second.reused_count, 2);
    assert!(!second.would_mutate_queue);
    assert_eq!(
        materialized_queue_ids(&first.tasks),
        materialized_queue_ids(&second.tasks)
    );
    let service = workspace_service_for_test(&db_path);
    assert_eq!(
        service
            .list_agent_queue_tasks(&workspace_id)
            .expect("list tasks")
            .len(),
        2
    );

    remove_test_db_files(&db_path);
}

#[test]
fn prompt_pack_materialize_changed_specs_conflict_without_new_tasks() {
    for changed_pack in [
        changed_pack_prompt(),
        changed_pack_title(),
        changed_pack_dependencies(),
        changed_pack_run_settings(),
    ] {
        let (db_path, workspace_id) = test_workspace("Prompt pack conflict");
        let first = materialize_value(&db_path, &workspace_id, two_task_pack_with_dependency());
        assert_eq!(first.status, "created");

        let conflict = materialize_value(&db_path, &workspace_id, changed_pack);
        assert_eq!(conflict.status, "conflict", "{conflict:?}");
        assert_eq!(conflict.created_count, 0);
        assert_eq!(conflict.reused_count, 0);
        assert_eq!(conflict.conflict_count, 2);
        assert_eq!(conflict.errors[0].code, "prompt_pack_spec_conflict");
        assert!(!conflict.would_mutate_queue);

        let service = workspace_service_for_test(&db_path);
        assert_eq!(
            service
                .list_agent_queue_tasks(&workspace_id)
                .expect("list tasks")
                .len(),
            2
        );
        remove_test_db_files(&db_path);
    }
}

#[test]
fn prompt_pack_materialize_allows_same_pack_id_in_different_workspaces() {
    let db_path = unique_test_db_path();
    let first_workspace = create_workspace_in_db(&db_path, "Prompt pack workspace A");
    let second_workspace = create_workspace_in_db(&db_path, "Prompt pack workspace B");

    let first = materialize_value(&db_path, &first_workspace, valid_minimal_pack());
    let second = materialize_value(&db_path, &second_workspace, valid_minimal_pack());

    assert_eq!(first.status, "created");
    assert_eq!(second.status, "created");
    assert_ne!(first.tasks[0].queue_task_id, second.tasks[0].queue_task_id);

    let service = workspace_service_for_test(&db_path);
    assert_eq!(
        service
            .list_agent_queue_tasks(&first_workspace)
            .expect("list first workspace tasks")
            .len(),
        1
    );
    assert_eq!(
        service
            .list_agent_queue_tasks(&second_workspace)
            .expect("list second workspace tasks")
            .len(),
        1
    );

    remove_test_db_files(&db_path);
}

#[test]
fn prompt_pack_materialize_inconsistent_mapping_conflicts_without_recreating_tasks() {
    let (db_path, workspace_id) = test_workspace("Prompt pack inconsistent mapping");
    let created = materialize_value(&db_path, &workspace_id, valid_minimal_pack());
    let queue_task_id = created.tasks[0]
        .queue_task_id
        .clone()
        .expect("queue task id");

    workspace_service_for_test(&db_path)
        .delete_agent_queue_task(DeleteAgentQueueTaskInput {
            workspace_id: workspace_id.clone(),
            queue_item_id: queue_task_id,
        })
        .expect("delete mapped task");

    let conflict = materialize_value(&db_path, &workspace_id, valid_minimal_pack());
    assert_eq!(conflict.status, "conflict");
    assert_eq!(
        conflict.errors[0].code,
        "prompt_pack_mapping_integrity_conflict"
    );
    assert_eq!(conflict.created_count, 0);
    assert!(!conflict.would_mutate_queue);
    assert!(workspace_service_for_test(&db_path)
        .list_agent_queue_tasks(&workspace_id)
        .expect("list tasks")
        .is_empty());

    remove_test_db_files(&db_path);
}

#[test]
fn prompt_pack_stateful_preview_reports_create_reuse_and_conflict_without_mutation() {
    let (db_path, workspace_id) = test_workspace("Prompt pack stateful preview");

    let before = stateful_preview_value(&db_path, &workspace_id, valid_minimal_pack());
    assert_eq!(before.materialization_status, "not_materialized");
    assert!(before.would_create);
    assert!(!before.would_mutate_queue);
    assert!(workspace_service_for_test(&db_path)
        .list_agent_queue_tasks(&workspace_id)
        .expect("list tasks")
        .is_empty());

    let created = materialize_value(&db_path, &workspace_id, valid_minimal_pack());
    let queue_task_id = created.tasks[0]
        .queue_task_id
        .clone()
        .expect("queue task id");

    let after = stateful_preview_value(&db_path, &workspace_id, valid_minimal_pack());
    assert_eq!(after.materialization_status, "reusable");
    assert!(after.would_reuse);
    assert_eq!(
        after.tasks[0].queue_task_id.as_deref(),
        Some(queue_task_id.as_str())
    );
    assert!(!after.would_mutate_queue);

    let conflict = stateful_preview_value(&db_path, &workspace_id, changed_pack_prompt());
    assert_eq!(conflict.materialization_status, "conflict");
    assert!(conflict.would_conflict);
    assert_eq!(conflict.blockers[0].code, "prompt_pack_spec_conflict");
    assert_eq!(
        workspace_service_for_test(&db_path)
            .list_agent_queue_tasks(&workspace_id)
            .expect("list tasks")
            .len(),
        1
    );

    remove_test_db_files(&db_path);
}

#[test]
fn prompt_pack_materialize_result_serializes_with_camel_case_for_tauri() {
    let (db_path, workspace_id) = test_workspace("Prompt pack materialize serialization");
    let result = materialize_value(&db_path, &workspace_id, valid_minimal_pack());
    let serialized = serde_json::to_value(result).expect("serialize result");

    assert_eq!(serialized["status"], "created");
    assert!(serialized["packId"].is_string());
    assert!(serialized["packSpecHash"].is_string());
    assert_eq!(serialized["createdCount"], 1);
    assert_eq!(serialized["wouldStartWorkers"], false);
    assert_eq!(serialized["wouldCreateRunLinks"], false);
    assert_eq!(serialized["wouldMutateQueue"], true);
    assert!(serialized["tasks"][0]["packTaskId"].is_string());
    assert!(serialized["tasks"][0]["queueTaskId"].is_string());

    remove_test_db_files(&db_path);
}

#[test]
fn prompt_pack_storage_transaction_rolls_back_pack_mapping_and_tasks_on_error() {
    let (db_path, workspace_id) = test_workspace("Prompt pack rollback");
    let store = SqliteStore::open(&db_path).expect("open store");

    let result: Result<(), hobit_storage_sqlite::StorageError> =
        store.with_immediate_transaction(|store| {
            store.insert_agent_queue_prompt_pack_materialization(
                NewAgentQueuePromptPackMaterialization {
                    workspace_id: &workspace_id,
                    pack_id: "rollback-pack",
                    title: "Rollback Pack",
                    description: None,
                    pack_spec_hash: "pack-hash",
                    run_settings_hash: "settings-hash",
                    dependency_spec_hash: "dependency-hash",
                    full_preview_hash: "preview-hash",
                    task_count: 1,
                    created_at: Some("1"),
                    updated_at: Some("1"),
                },
            )?;
            store.create_agent_queue_task(NewAgentQueueTask {
                queue_item_id: "queue-task-rollback",
                workspace_id: &workspace_id,
                title: "Rollback Task",
                description: "",
                prompt: "Rollback prompt",
                status: "draft",
                priority: 3,
                depends_on: Some("[]"),
                execution_policy: Some("manual"),
                execution_workspace: None,
                codex_executable: None,
                sandbox: None,
                approval_policy: None,
                context_json: None,
                created_at: Some("1"),
                updated_at: Some("1"),
            })?;
            store.insert_agent_queue_prompt_pack_task_mapping(
                NewAgentQueuePromptPackTaskMapping {
                    workspace_id: &workspace_id,
                    pack_id: "rollback-pack",
                    pack_task_id: "rollback-task",
                    queue_task_id: "queue-task-rollback",
                    task_spec_hash: "task-hash",
                    created_at: Some("1"),
                    updated_at: Some("1"),
                },
            )?;
            Err(hobit_storage_sqlite::StorageError::InvalidParameterName(
                "forced prompt pack rollback".to_owned(),
            ))
        });
    assert!(result.is_err());

    let store = SqliteStore::open(&db_path).expect("reopen store");
    assert!(store
        .get_agent_queue_prompt_pack_materialization(&workspace_id, "rollback-pack")
        .expect("get pack")
        .is_none());
    assert!(store
        .list_agent_queue_prompt_pack_task_mappings(&workspace_id, "rollback-pack")
        .expect("list mappings")
        .is_empty());
    assert!(store
        .get_agent_queue_task(&workspace_id, "queue-task-rollback")
        .expect("get task")
        .is_none());

    remove_test_db_files(&db_path);
}

#[test]
fn dogfood_prompt_pack_file_preview_and_materialize_use_repo_fixture() {
    let db_path = unique_test_db_path();
    let workspace_id =
        create_workspace_with_root_in_db(&db_path, "Dogfood file fixture", repo_root_for_test());
    let request = dogfood_file_request(&workspace_id);

    let before = preview_agent_queue_prompt_pack_file_blocking(request.clone(), db_path.clone())
        .expect("preview dogfood pack file");
    let source = before.source.as_ref().expect("source metadata");
    assert_eq!(source.source_kind, "workspace_path");
    assert_eq!(
        source.workspace_relative_path,
        "docs/dogfood/queue-prompt-packs/hobit-queue-dogfood-next.json"
    );
    assert!(source.source_bytes > 0);
    assert!(source
        .source_hash
        .starts_with("prompt_pack_workspace_source:"));
    assert_eq!(before.status, "succeeded");
    let preview = before.preview.as_ref().expect("preview");
    assert_eq!(preview.pack.pack_id, "hobit-queue-dogfood-next");
    assert_eq!(preview.task_count, 5);
    assert_eq!(preview.dependency_count, 4);
    assert_eq!(preview.materialization_status, "not_materialized");
    assert!(preview.would_create);
    assert!(!preview.would_start_workers);
    assert!(!preview.would_create_run_links);
    assert!(!preview.would_mutate_queue);

    let created =
        materialize_agent_queue_prompt_pack_file_blocking(request.clone(), db_path.clone())
            .expect("materialize dogfood pack file");
    assert_eq!(created.status, "created");
    assert_eq!(created.task_count, 5);
    assert_eq!(created.created_count, 5);
    assert_eq!(created.reused_count, 0);
    assert!(created.source.is_some());
    assert!(!created.would_start_workers);
    assert!(!created.would_create_run_links);
    assert!(created.would_mutate_queue);

    let checkpoint_id = materialized_task(&created.tasks, "dogfood-foundation-checkpoint")
        .queue_task_id
        .clone()
        .expect("checkpoint queue task id");
    let hardening = materialized_task(&created.tasks, "dogfood-file-import-hardening");
    assert_eq!(
        hardening.dependency_queue_task_ids,
        vec![checkpoint_id.clone()]
    );
    let report_id = materialized_task(&created.tasks, "dogfood-selected-task-run-report")
        .queue_task_id
        .clone()
        .expect("report queue task id");
    assert_eq!(
        materialized_task(&created.tasks, "dogfood-next-implementation-block")
            .dependency_queue_task_ids,
        vec![report_id]
    );

    let service = workspace_service_for_test(&db_path);
    assert_eq!(
        service
            .list_agent_queue_tasks(&workspace_id)
            .expect("list dogfood queue tasks")
            .len(),
        5
    );
    let store = SqliteStore::open(&db_path).expect("open store");
    assert_eq!(
        store
            .list_agent_queue_prompt_pack_task_mappings(&workspace_id, "hobit-queue-dogfood-next")
            .expect("list dogfood mappings")
            .len(),
        5
    );
    for task in &created.tasks {
        let queue_task_id = task.queue_task_id.as_deref().expect("queue task id");
        assert!(store
            .list_agent_queue_task_run_links(&workspace_id, queue_task_id)
            .expect("list task run links")
            .is_empty());
    }
    assert!(store
        .list_widget_runs_for_widget(QUEUE_LOCAL_BACKEND_EXECUTION_TARGET_ID)
        .expect("list queue local widget runs")
        .is_empty());

    let reused =
        materialize_agent_queue_prompt_pack_file_blocking(request.clone(), db_path.clone())
            .expect("reuse dogfood pack file");
    assert_eq!(reused.status, "reused");
    assert_eq!(reused.created_count, 0);
    assert_eq!(reused.reused_count, 5);
    assert!(!reused.would_mutate_queue);
    assert_eq!(
        materialized_queue_ids(&created.tasks),
        materialized_queue_ids(&reused.tasks)
    );

    let after = preview_agent_queue_prompt_pack_file_blocking(request, db_path.clone())
        .expect("preview reusable dogfood pack file");
    let after_preview = after.preview.expect("after preview");
    assert_eq!(after_preview.materialization_status, "reusable");
    assert!(after_preview.would_reuse);
    assert!(!after_preview.would_mutate_queue);

    remove_test_db_files(&db_path);
}

#[test]
fn dogfood_prompt_pack_file_path_validation_rejects_unsafe_inputs() {
    let db_path = unique_test_db_path();
    let repo_root = repo_root_for_test();
    let workspace_id =
        create_workspace_with_root_in_db(&db_path, "Dogfood path validation", repo_root.clone());

    let traversal = preview_agent_queue_prompt_pack_file_blocking(
        AgentQueuePromptPackFileRequest {
            workspace_id: workspace_id.clone(),
            workspace_relative_path: "../Cargo.toml".to_owned(),
        },
        db_path.clone(),
    )
    .expect_err("traversal should be rejected");
    assert!(traversal.contains("workspace root"));

    let absolute = preview_agent_queue_prompt_pack_file_blocking(
        AgentQueuePromptPackFileRequest {
            workspace_id: workspace_id.clone(),
            workspace_relative_path: repo_root
                .join("docs/dogfood/queue-prompt-packs/hobit-queue-dogfood-next.json")
                .display()
                .to_string(),
        },
        db_path.clone(),
    )
    .expect_err("absolute path should be rejected");
    assert!(absolute.contains("workspace-relative"));

    let wrong_extension = preview_agent_queue_prompt_pack_file_blocking(
        AgentQueuePromptPackFileRequest {
            workspace_id: workspace_id.clone(),
            workspace_relative_path: "Cargo.toml".to_owned(),
        },
        db_path.clone(),
    )
    .expect_err("wrong extension should be rejected");
    assert!(wrong_extension.contains(".json"));

    let oversized_root = unique_temp_dir("hobit-prompt-pack-oversized");
    std::fs::create_dir_all(&oversized_root).expect("create oversized root");
    std::fs::write(
        oversized_root.join("oversized.json"),
        "x".repeat(512 * 1024 + 1),
    )
    .expect("write oversized pack");
    let oversized_workspace_id =
        create_workspace_with_root_in_db(&db_path, "Dogfood oversized", oversized_root.clone());
    let oversized = preview_agent_queue_prompt_pack_file_blocking(
        AgentQueuePromptPackFileRequest {
            workspace_id: oversized_workspace_id,
            workspace_relative_path: "oversized.json".to_owned(),
        },
        db_path.clone(),
    )
    .expect_err("oversized file should be rejected");
    assert!(oversized.contains("too large"));

    let _ = std::fs::remove_dir_all(oversized_root);
    remove_test_db_files(&db_path);
}

fn test_workspace(title: &str) -> (PathBuf, String) {
    let db_path = unique_test_db_path();
    let workspace_id = create_workspace_in_db(&db_path, title);
    (db_path, workspace_id)
}

fn create_workspace_in_db(db_path: &Path, title: &str) -> String {
    let store = SqliteStore::open(db_path).expect("open store");
    store.init_schema().expect("init schema");
    let service = WorkspaceService::new(store);
    service
        .create_empty_workspace(title, None)
        .expect("create workspace")
        .id
}

fn create_workspace_with_root_in_db(db_path: &Path, title: &str, root_path: PathBuf) -> String {
    let store = SqliteStore::open(db_path).expect("open store");
    store.init_schema().expect("init schema");
    let service = WorkspaceService::new(store);
    service
        .create_empty_workspace_with_root_path(title, None, Some(root_path.display().to_string()))
        .expect("create workspace with root")
        .id
}

fn workspace_service_for_test(db_path: &Path) -> WorkspaceService {
    let store = SqliteStore::open(db_path).expect("open store");
    WorkspaceService::new(store)
}

fn materialize_value(
    db_path: &Path,
    workspace_id: &str,
    value: Value,
) -> hobit_app::AgentQueuePromptPackMaterializeResult {
    materialize_agent_queue_prompt_pack_blocking(
        AgentQueuePromptPackMaterializeRequest {
            workspace_id: workspace_id.to_owned(),
            json_payload: value.to_string(),
        },
        db_path.to_path_buf(),
    )
    .expect("materialize prompt pack")
}

fn stateful_preview_value(
    db_path: &Path,
    workspace_id: &str,
    value: Value,
) -> hobit_app::AgentQueuePromptPackPreview {
    preview_agent_queue_prompt_pack_stateful_blocking(
        AgentQueuePromptPackPreviewRequest {
            workspace_id: workspace_id.to_owned(),
            json_payload: value.to_string(),
        },
        db_path.to_path_buf(),
    )
    .expect("preview prompt pack")
    .preview
    .expect("preview")
}

fn materialized_task<'a>(
    tasks: &'a [hobit_app::AgentQueuePromptPackMaterializedTaskResult],
    pack_task_id: &str,
) -> &'a hobit_app::AgentQueuePromptPackMaterializedTaskResult {
    tasks
        .iter()
        .find(|task| task.pack_task_id == pack_task_id)
        .unwrap_or_else(|| panic!("missing materialized task {pack_task_id}"))
}

fn materialized_queue_ids(
    tasks: &[hobit_app::AgentQueuePromptPackMaterializedTaskResult],
) -> Vec<(String, Option<String>)> {
    let mut ids = tasks
        .iter()
        .map(|task| (task.pack_task_id.clone(), task.queue_task_id.clone()))
        .collect::<Vec<_>>();
    ids.sort();
    ids
}

fn assert_no_runtime_artifacts(db_path: &Path, workspace_id: &str) {
    let store = SqliteStore::open(db_path).expect("open store");
    assert!(store
        .list_widget_runs_for_widget("agent-run-widget")
        .expect("list widget runs")
        .is_empty());
    assert!(store
        .list_agent_queue_task_run_links(workspace_id, "queue-task")
        .expect("list run links")
        .is_empty());
    assert!(store
        .list_agent_queue_workflow_actions(workspace_id, "workflow-run")
        .expect("list workflow actions")
        .is_empty());
    assert!(store
        .list_agent_queue_workers(workspace_id)
        .expect("list queue workers")
        .is_empty());
}

fn preview_value(value: Value) -> hobit_app::AgentQueuePromptPackPreviewResult {
    preview_agent_queue_prompt_pack_blocking(AgentQueuePromptPackPreviewRequest {
        workspace_id: "workspace-1".to_owned(),
        json_payload: value.to_string(),
    })
}

fn valid_preview(
    result: hobit_app::AgentQueuePromptPackPreviewResult,
) -> hobit_app::AgentQueuePromptPackPreview {
    assert_eq!(result.status, "succeeded", "{result:?}");
    assert!(result.errors.is_empty(), "{:?}", result.errors);
    result.preview.expect("preview")
}

fn assert_invalid_payload(payload: &str, expected_code: &str) {
    let result = preview_agent_queue_prompt_pack_blocking(AgentQueuePromptPackPreviewRequest {
        workspace_id: "workspace-1".to_owned(),
        json_payload: payload.to_owned(),
    });
    assert_eq!(result.status, "invalid", "{result:?}");
    assert_eq!(result.errors.len(), 1);
    assert_eq!(result.errors[0].code, expected_code, "{result:?}");
    assert!(result.preview.is_none());
}

fn assert_invalid_value(value: Value, expected_code: &str) {
    assert_invalid_payload(&value.to_string(), expected_code);
}

fn valid_minimal_pack() -> Value {
    json!({
        "version": 1,
        "packId": "hobit-queue-dogfood-next",
        "title": "Hobit Queue Dogfood Next",
        "tasks": [
            {
                "id": "dogfood-status-checkpoint",
                "title": "Dogfood status checkpoint",
                "prompt": "Summarize the current dogfood state."
            }
        ]
    })
}

fn dogfood_file_request(workspace_id: &str) -> AgentQueuePromptPackFileRequest {
    AgentQueuePromptPackFileRequest {
        workspace_id: workspace_id.to_owned(),
        workspace_relative_path: "docs/dogfood/queue-prompt-packs/hobit-queue-dogfood-next.json"
            .to_owned(),
    }
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

fn unique_temp_dir(prefix: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time")
        .as_nanos();
    std::env::temp_dir().join(format!("{prefix}-{}-{nanos}", std::process::id()))
}

fn two_task_pack_with_dependency() -> Value {
    let mut pack = valid_minimal_pack();
    pack["runSettings"] = json!({
        "executionTarget": {
            "kind": "queue_local",
            "providerId": "codex"
        },
        "executionPolicy": "manual",
        "sandbox": "workspace_write",
        "approvalPolicy": "never"
    });
    pack["tasks"] = json!([
        {
            "id": "task-a",
            "title": "Task A",
            "prompt": "Run A."
        },
        {
            "id": "task-b",
            "title": "Task B",
            "prompt": "Run B.",
            "dependsOn": ["task-a"]
        }
    ]);
    pack
}

fn changed_pack_prompt() -> Value {
    let mut pack = two_task_pack_with_dependency();
    pack["tasks"][1]["prompt"] = json!("Run B with changed prompt.");
    pack
}

fn changed_pack_title() -> Value {
    let mut pack = two_task_pack_with_dependency();
    pack["tasks"][1]["title"] = json!("Task B changed title");
    pack
}

fn changed_pack_dependencies() -> Value {
    let mut pack = two_task_pack_with_dependency();
    pack["tasks"][1]["dependsOn"] = json!([]);
    pack
}

fn changed_pack_run_settings() -> Value {
    let mut pack = two_task_pack_with_dependency();
    pack["runSettings"]["sandbox"] = json!("read_only");
    pack
}

fn task<'a>(
    tasks: &'a [hobit_app::AgentQueuePromptPackTaskPreview],
    id: &str,
) -> &'a hobit_app::AgentQueuePromptPackTaskPreview {
    tasks
        .iter()
        .find(|task| task.id == id)
        .unwrap_or_else(|| panic!("missing task {id}"))
}

fn unique_test_db_path() -> PathBuf {
    let mut path = std::env::temp_dir();
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time")
        .as_nanos();
    path.push(format!(
        "hobit-tauri-prompt-pack-preview-test-{}-{nanos}.sqlite",
        std::process::id()
    ));
    path
}

fn remove_test_db_files(path: &Path) {
    let _ = std::fs::remove_file(path);
    let _ = std::fs::remove_file(path.with_extension("sqlite-wal"));
    let _ = std::fs::remove_file(path.with_extension("sqlite-shm"));
}
