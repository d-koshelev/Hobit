use super::*;

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

fn create_workspace(service: &WorkspaceService, title: &str) -> WorkspaceSummary {
    service
        .create_empty_workspace(title, None)
        .expect("create workspace")
}

fn create_task(service: &WorkspaceService, workspace_id: &str) -> AgentQueueTaskSummary {
    service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace_id.to_owned(),
            title: "Context task".to_owned(),
            description: "Description".to_owned(),
            prompt: "Run the task".to_owned(),
            status: "queued".to_owned(),
            priority: 2,
            depends_on: None,
            execution_policy: None,
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
        })
        .expect("create queue task")
}

fn create_document(
    service: &WorkspaceService,
    workspace_id: &str,
    enabled: bool,
    lifecycle_status: &str,
) -> KnowledgeDocumentSummary {
    service
        .create_knowledge_document(CreateKnowledgeDocumentInput {
            workspace_id: workspace_id.to_owned(),
            scope: Some("workspace".to_owned()),
            catalog_item_type: Some("documentation_knowledge".to_owned()),
            quick_summary: Some("Use the bounded summary.".to_owned()),
            lifecycle_status: Some(lifecycle_status.to_owned()),
            title: "Durable docs".to_owned(),
            source_label: "Operator authored".to_owned(),
            source_kind: Some("manual".to_owned()),
            source_ref: Some("doc-ref".to_owned()),
            source_refs: Vec::new(),
            relations: Vec::new(),
            content: "Bounded body for the queue task. This should be capped before use."
                .to_owned(),
            tags: "queue".to_owned(),
            enabled,
            searchable: true,
            version_summary: None,
            reviewed_at: None,
            created_by_task_id: None,
            created_from_run_id: None,
        })
        .expect("create document")
}

fn create_skill(
    service: &WorkspaceService,
    workspace_id: &str,
    review_status: &str,
) -> SkillSummary {
    service
        .create_skill(CreateSkillInput {
            workspace_id: workspace_id.to_owned(),
            title: "Reviewed skill".to_owned(),
            when_to_use: "Use for Queue context tests.".to_owned(),
            prerequisites: "Workspace is open.".to_owned(),
            steps: "Run focused validation.".to_owned(),
            validation: "Tests pass.".to_owned(),
            risks: "Keep context bounded.".to_owned(),
            tags: "queue, skill".to_owned(),
            review_status: review_status.to_owned(),
        })
        .expect("create skill")
}

#[test]
fn generic_task_create_update_cannot_inject_context_json() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Queue workspace");
    let task = create_task(&service, &workspace.id);

    assert_eq!(task.context_json, None);

    let updated = service
        .update_agent_queue_task(UpdateAgentQueueTaskInput {
            workspace_id: workspace.id.clone(),
            queue_item_id: task.queue_item_id.clone(),
            title: "Edited".to_owned(),
            description: "Description".to_owned(),
            prompt: "Run the edited task".to_owned(),
            status: "queued".to_owned(),
            priority: 2,
            depends_on: None,
            execution_policy: None,
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
        })
        .expect("update task")
        .expect("updated task");

    assert_eq!(updated.context_json, None);
}

#[test]
fn attach_active_knowledge_persists_and_reload_includes_durable_context() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Queue workspace");
    let task = create_task(&service, &workspace.id);
    let document = create_document(&service, &workspace.id, true, "active");

    let attached = service
        .attach_knowledge_to_queue_task(AttachKnowledgeToQueueTaskInput {
            workspace_id: workspace.id.clone(),
            queue_item_id: task.queue_item_id.clone(),
            knowledge_id: document.knowledge_document_id.clone(),
        })
        .expect("attach knowledge");

    let context_json = attached.context_json.expect("context json");
    assert!(context_json.contains(&document.knowledge_document_id));
    assert!(context_json.contains("attachedKnowledgeRefs"));
    assert!(context_json.contains("attachedKnowledgeSnapshots"));

    let reloaded = service
        .get_agent_queue_task(&workspace.id, &task.queue_item_id)
        .expect("get task")
        .expect("task");
    assert_eq!(
        reloaded.context_json.as_deref(),
        Some(context_json.as_str())
    );

    let listed = service
        .list_agent_queue_tasks(&workspace.id)
        .expect("list tasks");
    assert_eq!(
        listed[0].context_json.as_deref(),
        Some(context_json.as_str())
    );
}

#[test]
fn disabled_knowledge_attach_is_blocked() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Queue workspace");
    let task = create_task(&service, &workspace.id);
    let document = create_document(&service, &workspace.id, false, "active");

    let error = service
        .attach_knowledge_to_queue_task(AttachKnowledgeToQueueTaskInput {
            workspace_id: workspace.id,
            queue_item_id: task.queue_item_id,
            knowledge_id: document.knowledge_document_id,
        })
        .expect_err("disabled knowledge blocked");

    assert!(error
        .to_string()
        .contains("disabled Knowledge cannot attach"));
}

#[test]
fn rejected_knowledge_attach_is_blocked() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Queue workspace");
    let task = create_task(&service, &workspace.id);
    let document = create_document(&service, &workspace.id, true, "rejected");

    let error = service
        .attach_knowledge_to_queue_task(AttachKnowledgeToQueueTaskInput {
            workspace_id: workspace.id,
            queue_item_id: task.queue_item_id,
            knowledge_id: document.knowledge_document_id,
        })
        .expect_err("rejected knowledge blocked");

    assert!(error
        .to_string()
        .contains("rejected Knowledge cannot attach"));
}

#[test]
fn reviewed_skill_attach_persists_and_deprecated_skill_is_blocked() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Queue workspace");
    let task = create_task(&service, &workspace.id);
    let skill = create_skill(&service, &workspace.id, "reviewed");
    let deprecated = create_skill(&service, &workspace.id, "deprecated");

    let attached = service
        .attach_skill_to_queue_task(AttachSkillToQueueTaskInput {
            workspace_id: workspace.id.clone(),
            queue_item_id: task.queue_item_id.clone(),
            skill_id: skill.skill_id.clone(),
        })
        .expect("attach skill");
    assert!(attached
        .context_json
        .expect("context")
        .contains(&skill.skill_id));

    let error = service
        .attach_skill_to_queue_task(AttachSkillToQueueTaskInput {
            workspace_id: workspace.id,
            queue_item_id: task.queue_item_id,
            skill_id: deprecated.skill_id,
        })
        .expect_err("deprecated skill blocked");
    assert!(error.to_string().contains("deprecated Skill cannot attach"));
}

#[test]
fn materialization_blocks_rejected_persisted_context() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Queue workspace");
    let task = create_task(&service, &workspace.id);
    let context_json = serde_json::json!({
        "attachedKnowledgeRefs": [{
            "attachedAt": "2026-06-04T10:00:00.000Z",
            "id": "doc-rejected",
            "kind": "knowledge_document",
            "quickSummary": "Rejected summary.",
            "scope": "workspace-local",
            "source": "Workspace document",
            "status": "rejected",
            "title": "Rejected docs",
            "version": "1"
        }],
        "attachedSkillRefs": [],
        "attachedKnowledgeSnapshots": [{
            "capped": false,
            "content": "Rejected content must not be used.",
            "id": "snapshot:knowledge_document:doc-rejected:2026-06-04T10:00:00.000Z",
            "kind": "knowledge_document",
            "materializedAt": "2026-06-04T10:00:00.000Z",
            "scope": "workspace-local",
            "source": "Workspace document",
            "sourceRefId": "doc-rejected",
            "status": "rejected",
            "title": "Rejected docs",
            "tokenEstimate": 8,
            "version": "1"
        }],
        "contextWarnings": [],
        "contextTokenBudget": {
            "estimatedTokens": 8,
            "maxTokens": 1600,
            "overBudget": false
        },
        "materializedAt": "2026-06-04T10:00:00.000Z"
    })
    .to_string();

    service
        .store
        .update_agent_queue_task_context(
            &workspace.id,
            &task.queue_item_id,
            Some(&context_json),
            Some("2026-06-04T10:00:00.000Z"),
        )
        .expect("inject internal context");

    let error = service
        .materialize_agent_queue_task_context_prompt(&workspace.id, &task.queue_item_id)
        .expect_err("rejected context blocked");

    assert!(error.to_string().contains("blocked refs"));
}

#[test]
fn detach_context_ref_persists() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Queue workspace");
    let task = create_task(&service, &workspace.id);
    let document = create_document(&service, &workspace.id, true, "active");

    service
        .attach_knowledge_to_queue_task(AttachKnowledgeToQueueTaskInput {
            workspace_id: workspace.id.clone(),
            queue_item_id: task.queue_item_id.clone(),
            knowledge_id: document.knowledge_document_id.clone(),
        })
        .expect("attach knowledge");

    let detached = service
        .detach_knowledge_from_queue_task(DetachKnowledgeFromQueueTaskInput {
            workspace_id: workspace.id,
            queue_item_id: task.queue_item_id,
            knowledge_id: document.knowledge_document_id.clone(),
        })
        .expect("detach knowledge");

    let context_json = detached.context_json.expect("context json");
    assert!(context_json.contains("\"attachedKnowledgeRefs\":[]"));
    assert!(!context_json.contains(&document.knowledge_document_id));
}

#[test]
fn materialized_prompt_includes_visible_context_and_context_used_report() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Queue workspace");
    let task = create_task(&service, &workspace.id);
    let document = create_document(&service, &workspace.id, true, "active");

    service
        .attach_knowledge_to_queue_task(AttachKnowledgeToQueueTaskInput {
            workspace_id: workspace.id.clone(),
            queue_item_id: task.queue_item_id.clone(),
            knowledge_id: document.knowledge_document_id,
        })
        .expect("attach knowledge");

    let materialized = service
        .materialize_agent_queue_task_context_prompt(&workspace.id, &task.queue_item_id)
        .expect("materialize")
        .expect("prompt");

    assert!(materialized.starts_with("Knowledge / Skills context"));
    assert!(materialized.contains("Run the task"));
    assert!(materialized.contains("Context used"));
    assert!(materialized.contains("Knowledge refs used:"));
}

#[test]
fn no_context_task_has_no_materialized_prompt() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Queue workspace");
    let task = create_task(&service, &workspace.id);

    let materialized = service
        .materialize_agent_queue_task_context_prompt(&workspace.id, &task.queue_item_id)
        .expect("materialize");

    assert_eq!(materialized, None);
}

#[test]
fn materialized_queue_context_warns_for_large_or_secret_knowledge() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Queue workspace");
    let task = create_task(&service, &workspace.id);
    let mut document = create_document(&service, &workspace.id, true, "active");
    document = service
        .update_knowledge_document(UpdateKnowledgeDocumentInput {
            workspace_id: workspace.id.clone(),
            knowledge_document_id: document.knowledge_document_id,
            scope: Some("workspace".to_owned()),
            catalog_item_type: Some("documentation_knowledge".to_owned()),
            quick_summary: Some("Large secret-bearing document.".to_owned()),
            lifecycle_status: Some("active".to_owned()),
            title: "Large secret docs".to_owned(),
            source_label: "Operator authored".to_owned(),
            source_kind: Some("manual".to_owned()),
            source_ref: Some("doc-ref".to_owned()),
            source_refs: Vec::new(),
            relations: Vec::new(),
            content: format!("{}\napi_key=example-token", "A".repeat(120_000)),
            tags: "queue".to_owned(),
            enabled: true,
            searchable: true,
            version_summary: None,
            reviewed_at: None,
            created_by_task_id: None,
            created_from_run_id: None,
        })
        .expect("update document")
        .expect("updated document");

    let attached = service
        .attach_knowledge_to_queue_task(AttachKnowledgeToQueueTaskInput {
            workspace_id: workspace.id.clone(),
            queue_item_id: task.queue_item_id.clone(),
            knowledge_id: document.knowledge_document_id,
        })
        .expect("attach knowledge");
    let context_json = attached.context_json.expect("context json");

    assert!(context_json.contains("large_content"));
    assert!(context_json.contains("possible_secret"));
    assert!(context_json.contains("\"capped\":true"));

    let materialized = service
        .materialize_agent_queue_task_context_prompt(&workspace.id, &task.queue_item_id)
        .expect("materialize")
        .expect("prompt");
    assert!(materialized.contains("possible_secret"));
    assert!(materialized.contains("[Capped excerpt]"));
}
