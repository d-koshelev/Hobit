use super::*;

fn initialized_store() -> SqliteStore {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    store
}

fn create_workspace_and_workbench(store: &SqliteStore) {
    store
        .create_workspace("workspace-1", "Incident", Some("Investigate"), "active")
        .expect("create workspace");
    store
        .create_workspace_workbench("workbench-1", "workspace-1", None)
        .expect("create workbench");
}

fn insert_widget(store: &SqliteStore) {
    store
        .insert_widget_instance(NewWidgetInstance {
            id: "widget-1",
            workspace_id: "workspace-1",
            workbench_id: "workbench-1",
            definition_id: "notes",
            title: "Notes",
            category: "notes",
            layout_mode: "popped_out",
            dock_x: Some(10),
            dock_y: Some(20),
            dock_width: Some(480),
            dock_height: Some(320),
            popout_x: Some(100),
            popout_y: Some(120),
            popout_width: Some(640),
            popout_height: Some(480),
            always_on_top: true,
            is_visible: true,
            config: Some("{scope:workspace}"),
            state: Some("{dirty:false}"),
        })
        .expect("insert widget");
}

fn insert_widget_run(store: &SqliteStore) -> WidgetRunRow {
    store
        .insert_widget_run(NewWidgetRun {
            id: "run-1",
            widget_instance_id: "widget-1",
            status: "completed",
            command_kind: Some("save_note"),
            command_payload: Some("{note:1}"),
            started_at: Some("1"),
            finished_at: Some("2"),
            summary: Some("Saved note"),
        })
        .expect("insert run")
}

#[test]
fn init_schema_is_idempotent() {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");

    store.init_schema().expect("first init");
    store.init_schema().expect("second init");

    let foreign_keys_enabled: i64 = store
        .connection
        .query_row("PRAGMA foreign_keys", [], |row| row.get(0))
        .expect("foreign key pragma");

    assert_eq!(foreign_keys_enabled, 1);
}

#[test]
fn transaction_rolls_back_when_operation_fails() {
    let store = initialized_store();

    let result = store.with_immediate_transaction(|store| {
        store.create_workspace("workspace-rollback", "Rollback", None, "active")?;
        store.create_workspace_workbench("workbench-rollback", "missing-workspace", None)?;
        Ok(())
    });

    assert!(result.is_err());
    assert!(store
        .get_workspace("workspace-rollback")
        .expect("get rolled back workspace")
        .is_none());
    assert!(store
        .get_workspace_workbench("workbench-rollback")
        .expect("get rolled back workbench")
        .is_none());
}

#[test]
fn init_schema_upgrades_widget_log_and_result_columns() {
    let store = initialized_store();
    create_workspace_and_workbench(&store);
    insert_widget(&store);
    insert_widget_run(&store);

    store
        .connection
        .execute_batch(
            r#"
                DROP TABLE widget_logs;
                DROP TABLE widget_results;

                CREATE TABLE widget_logs (
                    id TEXT PRIMARY KEY,
                    run_id TEXT NOT NULL REFERENCES widget_runs(id),
                    level TEXT NOT NULL,
                    message TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    details TEXT NULL
                );

                CREATE TABLE widget_results (
                    id TEXT PRIMARY KEY,
                    run_id TEXT NOT NULL REFERENCES widget_runs(id),
                    status TEXT NOT NULL,
                    summary TEXT NULL,
                    payload TEXT NULL,
                    created_at TEXT NOT NULL
                );

                INSERT INTO widget_logs (
                    id, run_id, level, message, created_at, details
                ) VALUES (
                    'legacy-log', 'run-1', 'info', 'Legacy log', '1', NULL
                );

                INSERT INTO widget_results (
                    id, run_id, status, summary, payload, created_at
                ) VALUES (
                    'legacy-result', 'run-1', 'completed', 'Legacy result', '{ok:true}', '1'
                );
                "#,
        )
        .expect("create legacy widget tables");

    store.init_schema().expect("upgrade schema");

    let legacy_log = store
        .get_widget_log("legacy-log")
        .expect("get legacy log")
        .expect("legacy log");
    let legacy_result = store
        .get_widget_result("legacy-result")
        .expect("get legacy result")
        .expect("legacy result");
    let widget_local_log = store
        .append_widget_log(NewWidgetLog {
            id: "widget-local-log",
            widget_instance_id: "widget-1",
            run_id: None,
            level: "info",
            message: "Widget-local log",
            created_at: Some("2"),
            details: None,
        })
        .expect("append widget-local log");

    assert_eq!(legacy_log.widget_instance_id, "widget-1");
    assert_eq!(legacy_log.run_id.as_deref(), Some("run-1"));
    assert_eq!(legacy_result.result_type, "generic");
    assert_eq!(legacy_result.content, None);
    assert_eq!(widget_local_log.run_id, None);
}

#[test]
fn init_schema_upgrades_agent_queue_task_assignment_column() {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store
        .connection
        .execute_batch(
            r#"
                CREATE TABLE workspaces (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT NULL,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE agent_queue_tasks (
                    queue_item_id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    prompt TEXT NOT NULL,
                    status TEXT NOT NULL,
                    priority INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                INSERT INTO workspaces (
                    id, title, description, status, created_at, updated_at
                ) VALUES (
                    'workspace-1', 'Workspace', NULL, 'active', '1', '1'
                );

                INSERT INTO agent_queue_tasks (
                    queue_item_id, workspace_id, title, description, prompt,
                    status, priority, created_at, updated_at
                ) VALUES (
                    'task-1', 'workspace-1', 'Task', 'Description', 'Prompt',
                    'queued', 1, '1', '1'
                );
                "#,
        )
        .expect("create legacy agent queue task table");

    store.init_schema().expect("upgrade schema");

    let task = store
        .get_agent_queue_task("workspace-1", "task-1")
        .expect("get upgraded queue task")
        .expect("upgraded queue task");

    assert_eq!(task.assigned_executor_widget_id, None);
    assert_eq!(task.execution_policy, "manual");
}

#[test]
fn create_and_load_workspace() {
    let store = initialized_store();

    let created = store
        .create_workspace("workspace-1", "Incident", Some("Investigate"), "active")
        .expect("create workspace");
    let loaded = store
        .get_workspace("workspace-1")
        .expect("load workspace")
        .expect("workspace row");

    assert_eq!(created.id, loaded.id);
    assert_eq!(loaded.title, "Incident");
    assert_eq!(loaded.description.as_deref(), Some("Investigate"));
    assert_eq!(loaded.status, "active");
}

#[test]
fn create_workspace_with_empty_workbench() {
    let store = initialized_store();

    store
        .create_workspace("workspace-1", "Empty", None, "active")
        .expect("create workspace");
    let workbench = store
        .create_workspace_workbench("workbench-1", "workspace-1", None)
        .expect("create workbench");
    let widgets = store
        .list_widget_instances("workspace-1")
        .expect("list widget instances");

    assert_eq!(workbench.workspace_id, "workspace-1");
    assert!(widgets.is_empty());
}

#[test]
fn list_workspaces_returns_created_rows() {
    let store = initialized_store();

    store
        .create_workspace("workspace-1", "First", None, "active")
        .expect("create first workspace");
    store
        .create_workspace("workspace-2", "Second", None, "active")
        .expect("create second workspace");

    let workspaces = store.list_workspaces().expect("list workspaces");

    assert_eq!(workspaces.len(), 2);
    assert!(workspaces
        .iter()
        .any(|workspace| workspace.id == "workspace-1"));
    assert!(workspaces
        .iter()
        .any(|workspace| workspace.id == "workspace-2"));
}

#[test]
fn list_workspace_summaries_with_workbench_returns_first_workbench_without_duplicates() {
    let store = initialized_store();

    store
        .create_workspace("workspace-older", "Older", None, "active")
        .expect("create older workspace");
    store
        .create_workspace_workbench("workbench-later", "workspace-older", None)
        .expect("create later workbench");
    store
        .create_workspace_workbench("workbench-first", "workspace-older", None)
        .expect("create first workbench");
    store
        .create_workspace("workspace-newer", "Newer", None, "active")
        .expect("create newer workspace");

    for (workbench_id, created_at) in [("workbench-later", "2"), ("workbench-first", "1")] {
        store
            .connection
            .execute(
                "UPDATE workspace_workbenches SET created_at = ?1 WHERE id = ?2",
                rusqlite::params![created_at, workbench_id],
            )
            .expect("set workbench created_at");
    }
    for (workspace_id, updated_at) in [("workspace-older", "1"), ("workspace-newer", "2")] {
        store
            .connection
            .execute(
                "UPDATE workspaces SET updated_at = ?1 WHERE id = ?2",
                rusqlite::params![updated_at, workspace_id],
            )
            .expect("set workspace updated_at");
    }

    let summaries = store
        .list_workspace_summaries_with_workbench()
        .expect("list workspace summaries");

    assert_eq!(summaries.len(), 2);
    assert_eq!(
        summaries
            .iter()
            .map(|workspace| workspace.id.as_str())
            .collect::<Vec<_>>(),
        vec!["workspace-newer", "workspace-older"]
    );
    assert_eq!(summaries[0].workbench_id, None);
    assert_eq!(
        summaries[1].workbench_id.as_deref(),
        Some("workbench-first")
    );
}

#[test]
fn list_workspace_summaries_includes_metadata_and_scoped_counts() {
    let store = initialized_store();

    store
        .create_workspace("workspace-1", "Primary", None, "active")
        .expect("create workspace");
    store
        .create_workspace_workbench("workbench-1", "workspace-1", None)
        .expect("create workbench");
    store
        .create_workspace("workspace-2", "Other", None, "active")
        .expect("create other workspace");
    store
        .create_workspace_workbench("workbench-2", "workspace-2", None)
        .expect("create other workbench");
    store
        .create_workspace_session(NewWorkspaceSession {
            id: "session-1",
            workspace_id: "workspace-1",
            status: "open",
            opened_at: Some("10"),
            closed_at: None,
            active_widget_id: None,
            current_focus_kind: None,
            current_focus_ref: None,
        })
        .expect("create older session");
    store
        .create_workspace_session(NewWorkspaceSession {
            id: "session-2",
            workspace_id: "workspace-1",
            status: "open",
            opened_at: Some("20"),
            closed_at: None,
            active_widget_id: None,
            current_focus_kind: None,
            current_focus_ref: None,
        })
        .expect("create newer session");
    store
        .insert_widget_instance(NewWidgetInstance {
            id: "agent-1",
            workspace_id: "workspace-1",
            workbench_id: "workbench-1",
            definition_id: "interactive-agent",
            title: "Workspace Agent",
            category: "core",
            layout_mode: "docked",
            dock_x: Some(0),
            dock_y: Some(0),
            dock_width: Some(360),
            dock_height: Some(240),
            popout_x: None,
            popout_y: None,
            popout_width: None,
            popout_height: None,
            always_on_top: false,
            is_visible: true,
            config: Some("{}"),
            state: Some("{}"),
        })
        .expect("insert workspace agent");
    store
        .insert_widget_instance(NewWidgetInstance {
            id: "notes-widget-1",
            workspace_id: "workspace-1",
            workbench_id: "workbench-1",
            definition_id: "notes",
            title: "Notes",
            category: "notes",
            layout_mode: "docked",
            dock_x: Some(0),
            dock_y: Some(256),
            dock_width: Some(360),
            dock_height: Some(240),
            popout_x: None,
            popout_y: None,
            popout_width: None,
            popout_height: None,
            always_on_top: false,
            is_visible: true,
            config: Some("{}"),
            state: Some("{}"),
        })
        .expect("insert notes widget");
    store
        .insert_widget_instance(NewWidgetInstance {
            id: "other-agent",
            workspace_id: "workspace-2",
            workbench_id: "workbench-2",
            definition_id: "interactive-agent",
            title: "Other Workspace Agent",
            category: "core",
            layout_mode: "docked",
            dock_x: Some(0),
            dock_y: Some(0),
            dock_width: Some(360),
            dock_height: Some(240),
            popout_x: None,
            popout_y: None,
            popout_width: None,
            popout_height: None,
            always_on_top: false,
            is_visible: true,
            config: Some("{}"),
            state: Some("{}"),
        })
        .expect("insert other workspace agent");
    store
        .create_note(NewWorkspaceNote {
            note_id: "note-1",
            workspace_id: "workspace-1",
            title: "Note",
            body: "Body",
            pinned: false,
            archived: false,
            created_at: Some("1"),
            updated_at: Some("1"),
        })
        .expect("create note");
    store
        .create_skill(NewSkill {
            skill_id: "skill-1",
            workspace_id: "workspace-1",
            title: "Skill",
            when_to_use: "",
            prerequisites: "",
            steps: "",
            validation: "",
            risks: "",
            tags: "",
            review_status: "draft",
            created_at: Some("1"),
            updated_at: Some("1"),
        })
        .expect("create skill");
    store
        .create_knowledge_document(NewKnowledgeDocument {
            knowledge_document_id: "doc-1",
            workspace_id: "workspace-1",
            scope: None,
            catalog_item_type: None,
            quick_summary: None,
            lifecycle_status: None,
            title: "Doc",
            source_label: "manual",
            source_kind: None,
            source_ref: None,
            source_refs: None,
            relations: None,
            content: "Content",
            tags: "",
            enabled: true,
            searchable: true,
            version_summary: None,
            created_at: Some("1"),
            updated_at: Some("1"),
            reviewed_at: None,
            created_by_task_id: None,
            created_from_run_id: None,
        })
        .expect("create document");
    store
        .create_agent_queue_task(NewAgentQueueTask {
            queue_item_id: "task-1",
            workspace_id: "workspace-1",
            title: "Task",
            description: "",
            prompt: "Prompt",
            status: "draft",
            priority: 0,
            depends_on: None,
            execution_policy: None,
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
            context_json: None,
            created_at: Some("1"),
            updated_at: Some("1"),
        })
        .expect("create queue task");

    let summary = store
        .get_workspace_summary_with_workbench("workspace-1")
        .expect("get workspace summary")
        .expect("workspace summary");

    assert_eq!(summary.last_opened_at.as_deref(), Some("20"));
    assert_eq!(summary.widget_count, 2);
    assert_eq!(summary.workspace_agent_count, 1);
    assert_eq!(summary.note_count, 1);
    assert_eq!(summary.skill_count, 1);
    assert_eq!(summary.knowledge_document_count, 1);
    assert_eq!(summary.queue_task_count, 1);
}

#[test]
fn touch_workspace_updates_updated_at() {
    let store = initialized_store();
    store
        .create_workspace("workspace-1", "Incident", None, "active")
        .expect("create workspace");
    store
        .connection
        .execute(
            "UPDATE workspaces SET updated_at = ?1 WHERE id = ?2",
            rusqlite::params!["1", "workspace-1"],
        )
        .expect("set stale updated_at");

    store
        .touch_workspace("workspace-1")
        .expect("touch workspace");

    let touched = store
        .get_workspace("workspace-1")
        .expect("get workspace")
        .expect("workspace row");

    assert_ne!(touched.updated_at, "1");
    assert!(touched.updated_at.as_str() > "1");
}

#[test]
fn create_and_load_workspace_session() {
    let store = initialized_store();
    store
        .create_workspace("workspace-1", "Incident", None, "active")
        .expect("create workspace");

    let session = store
        .create_workspace_session(NewWorkspaceSession {
            id: "session-1",
            workspace_id: "workspace-1",
            status: "open",
            opened_at: Some("1"),
            closed_at: None,
            active_widget_id: None,
            current_focus_kind: None,
            current_focus_ref: None,
        })
        .expect("create session");
    let loaded = store
        .get_workspace_session("session-1")
        .expect("load session")
        .expect("session row");

    assert_eq!(session, loaded);
    assert_eq!(loaded.workspace_id, "workspace-1");
    assert_eq!(loaded.status, "open");
}

#[test]
fn list_workspace_workbenches_for_workspace() {
    let store = initialized_store();
    store
        .create_workspace("workspace-1", "Incident", None, "active")
        .expect("create workspace");
    store
        .create_workspace_workbench("workbench-1", "workspace-1", None)
        .expect("create first workbench");
    store
        .create_workspace_workbench("workbench-2", "workspace-1", None)
        .expect("create second workbench");

    let workbenches = store
        .list_workspace_workbenches("workspace-1")
        .expect("list workbenches");

    assert_eq!(workbenches.len(), 2);
    assert!(workbenches
        .iter()
        .any(|workbench| workbench.id == "workbench-1"));
    assert!(workbenches
        .iter()
        .any(|workbench| workbench.id == "workbench-2"));
}

#[test]
fn insert_and_list_widget_instance_layout() {
    let store = initialized_store();
    create_workspace_and_workbench(&store);
    insert_widget(&store);

    let widgets = store
        .list_widget_instances("workspace-1")
        .expect("list widget instances");

    assert_eq!(widgets.len(), 1);
    assert_eq!(widgets[0].layout_mode, "popped_out");
    assert_eq!(widgets[0].dock_width, Some(480));
    assert_eq!(widgets[0].popout_width, Some(640));
    assert!(widgets[0].always_on_top);
}

#[test]
fn update_widget_instance_state_persists_state() {
    let store = initialized_store();
    create_workspace_and_workbench(&store);
    insert_widget(&store);
    let before_update = store
        .get_widget_instance("widget-1")
        .expect("get widget before update")
        .expect("widget row");

    store
        .update_widget_instance_state("widget-1", "{\"body\":\"Draft\"}")
        .expect("update widget state");

    let after_update = store
        .get_widget_instance("widget-1")
        .expect("get widget after update")
        .expect("widget row");

    assert_eq!(after_update.state.as_deref(), Some("{\"body\":\"Draft\"}"));
    assert_ne!(after_update.updated_at, before_update.updated_at);
}

#[test]
fn update_widget_instance_layout_persists_layout_fields() {
    let store = initialized_store();
    create_workspace_and_workbench(&store);
    insert_widget(&store);
    let before_update = store
        .get_widget_instance("widget-1")
        .expect("get widget before update")
        .expect("widget row");

    store
        .update_widget_instance_layout(
            "widget-1",
            WidgetInstanceLayoutUpdate {
                layout_mode: "docked",
                dock_x: Some(30),
                dock_y: Some(40),
                dock_width: Some(720),
                dock_height: Some(360),
                popout_x: None,
                popout_y: None,
                popout_width: None,
                popout_height: None,
                always_on_top: false,
                is_visible: false,
            },
        )
        .expect("update widget layout");

    let after_update = store
        .get_widget_instance("widget-1")
        .expect("get widget after update")
        .expect("widget row");

    assert_eq!(after_update.layout_mode, "docked");
    assert_eq!(after_update.dock_x, Some(30));
    assert_eq!(after_update.dock_y, Some(40));
    assert_eq!(after_update.dock_width, Some(720));
    assert_eq!(after_update.dock_height, Some(360));
    assert_eq!(after_update.popout_x, None);
    assert_eq!(after_update.popout_y, None);
    assert_eq!(after_update.popout_width, None);
    assert_eq!(after_update.popout_height, None);
    assert!(!after_update.always_on_top);
    assert!(!after_update.is_visible);
    assert_ne!(after_update.updated_at, before_update.updated_at);
}

#[test]
fn list_widget_instances_for_workbench_returns_only_that_workbench() {
    let store = initialized_store();
    create_workspace_and_workbench(&store);
    store
        .create_workspace_workbench("workbench-2", "workspace-1", None)
        .expect("create second workbench");

    insert_widget(&store);
    store
        .insert_widget_instance(NewWidgetInstance {
            id: "widget-2",
            workspace_id: "workspace-1",
            workbench_id: "workbench-2",
            definition_id: "notes",
            title: "Other Notes",
            category: "notes",
            layout_mode: "docked",
            dock_x: Some(0),
            dock_y: Some(0),
            dock_width: Some(320),
            dock_height: Some(240),
            popout_x: None,
            popout_y: None,
            popout_width: None,
            popout_height: None,
            always_on_top: false,
            is_visible: true,
            config: None,
            state: None,
        })
        .expect("insert second widget");

    let widgets = store
        .list_widget_instances_for_workbench("workbench-1")
        .expect("list workbench widgets");

    assert_eq!(widgets.len(), 1);
    assert_eq!(widgets[0].id, "widget-1");
    assert_eq!(widgets[0].workbench_id, "workbench-1");
}

#[test]
fn append_and_list_workbench_events() {
    let store = initialized_store();
    store
        .create_workspace("workspace-1", "Incident", None, "active")
        .expect("create workspace");

    store
        .append_workbench_event(
            "event-1",
            "workspace-1",
            "workspace_opened",
            "Workspace opened",
            Some("{source:test}"),
        )
        .expect("append event");
    let events = store
        .list_workbench_events("workspace-1")
        .expect("list events");

    assert_eq!(events.len(), 1);
    assert_eq!(events[0].kind, "workspace_opened");
    assert_eq!(events[0].payload.as_deref(), Some("{source:test}"));
}

#[test]
fn list_recent_workspace_events_respects_limit_and_order() {
    let store = initialized_store();
    create_workspace_and_workbench(&store);
    store
        .create_workspace("workspace-2", "Other", None, "active")
        .expect("create other workspace");
    store
        .create_workspace_workbench("workbench-2", "workspace-2", None)
        .expect("create other workbench");

    for event_id in ["event-1", "event-2", "event-3"] {
        store
            .append_workbench_event(
                event_id,
                "workspace-1",
                "workspace_changed",
                "Workspace changed",
                None,
            )
            .expect("append event");
    }
    store
        .append_workbench_event(
            "other-event",
            "workspace-2",
            "workspace_changed",
            "Other workspace changed",
            None,
        )
        .expect("append other event");

    for (event_id, created_at) in [
        ("event-1", "1"),
        ("event-2", "2"),
        ("event-3", "3"),
        ("other-event", "4"),
    ] {
        store
            .connection
            .execute(
                "UPDATE workbench_events SET created_at = ?1 WHERE id = ?2",
                rusqlite::params![created_at, event_id],
            )
            .expect("set event timestamp");
    }

    let events = store
        .list_recent_workspace_events("workspace-1", 2)
        .expect("list recent events");

    assert_eq!(event_ids(&events), vec!["event-2", "event-3"]);
}

#[test]
fn insert_widget_run_log_and_result() {
    let store = initialized_store();
    create_workspace_and_workbench(&store);
    insert_widget(&store);

    let run = insert_widget_run(&store);
    let log = store
        .append_widget_log(NewWidgetLog {
            id: "log-1",
            widget_instance_id: "widget-1",
            run_id: Some("run-1"),
            level: "info",
            message: "Saved note",
            created_at: Some("2"),
            details: None,
        })
        .expect("append log");
    let result = store
        .insert_widget_result(NewWidgetResult {
            id: "result-1",
            run_id: "run-1",
            status: "completed",
            result_type: Some("note"),
            summary: Some("Note persisted"),
            content: Some("Saved note content"),
            payload: Some("{ok:true}"),
            created_at: Some("2"),
        })
        .expect("insert result");

    assert_eq!(run.widget_instance_id, "widget-1");
    assert_eq!(log.widget_instance_id, "widget-1");
    assert_eq!(log.run_id.as_deref(), Some("run-1"));
    assert_eq!(result.result_type, "note");
    assert_eq!(result.summary.as_deref(), Some("Note persisted"));
    assert_eq!(result.content.as_deref(), Some("Saved note content"));
    assert_eq!(store.list_widget_logs("run-1").expect("list logs").len(), 1);
    assert_eq!(
        store
            .list_widget_logs_for_widget("widget-1", 100)
            .expect("list widget logs")
            .len(),
        1
    );
    assert_eq!(
        store
            .list_widget_results("run-1")
            .expect("list results")
            .len(),
        1
    );
}

#[test]
fn list_widget_runs_for_widget_desc_page_returns_newest_runs_first() {
    let store = initialized_store();
    create_workspace_and_workbench(&store);
    insert_widget(&store);

    for (id, started_at) in [("run-old", "1"), ("run-new", "3"), ("run-mid", "2")] {
        store
            .insert_widget_run(NewWidgetRun {
                id,
                widget_instance_id: "widget-1",
                status: "completed",
                command_kind: Some("save_note"),
                command_payload: None,
                started_at: Some(started_at),
                finished_at: None,
                summary: Some("Saved note"),
            })
            .expect("insert run");
    }

    let first_page = store
        .list_widget_runs_for_widget_desc_page("widget-1", 2, 0)
        .expect("list first run page");
    let second_page = store
        .list_widget_runs_for_widget_desc_page("widget-1", 2, 2)
        .expect("list second run page");

    assert_eq!(run_ids(&first_page), vec!["run-new", "run-mid"]);
    assert_eq!(run_ids(&second_page), vec!["run-old"]);
}

#[test]
fn list_widget_runs_for_widget_desc_page_orders_started_at_ties_by_id_desc() {
    let store = initialized_store();
    create_workspace_and_workbench(&store);
    insert_widget(&store);

    for id in ["run-a", "run-c", "run-b"] {
        store
            .insert_widget_run(NewWidgetRun {
                id,
                widget_instance_id: "widget-1",
                status: "completed",
                command_kind: Some("save_note"),
                command_payload: None,
                started_at: Some("1"),
                finished_at: None,
                summary: Some("Saved note"),
            })
            .expect("insert tied run");
    }

    let runs = store
        .list_widget_runs_for_widget_desc_page("widget-1", 10, 0)
        .expect("list run page");

    assert_eq!(run_ids(&runs), vec!["run-c", "run-b", "run-a"]);
}

#[test]
fn list_latest_widget_results_for_runs_by_type_batches_and_filters_results() {
    let store = initialized_store();
    create_workspace_and_workbench(&store);
    insert_widget(&store);
    insert_widget_run(&store);
    store
        .insert_widget_run(NewWidgetRun {
            id: "run-2",
            widget_instance_id: "widget-1",
            status: "completed",
            command_kind: Some("save_note"),
            command_payload: Some("{note:2}"),
            started_at: Some("3"),
            finished_at: Some("4"),
            summary: Some("Saved second note"),
        })
        .expect("insert second run");

    for (id, run_id, result_type, created_at) in [
        ("result-1-old", "run-1", "wanted_result", "2"),
        ("result-1-ignored", "run-1", "other_result", "3"),
        ("result-1-new", "run-1", "wanted_result", "4"),
        ("result-2", "run-2", "wanted_result", "5"),
    ] {
        store
            .insert_widget_result(NewWidgetResult {
                id,
                run_id,
                status: "completed",
                result_type: Some(result_type),
                summary: Some("Stored result"),
                content: None,
                payload: Some("{}"),
                created_at: Some(created_at),
            })
            .expect("insert result");
    }

    let results = store
        .list_latest_widget_results_for_runs_by_type(
            &[
                "run-1".to_owned(),
                "run-2".to_owned(),
                "missing-run".to_owned(),
            ],
            &["wanted_result"],
        )
        .expect("list latest results");

    assert_eq!(
        results.get("run-1").expect("run-1 result").id,
        "result-1-new"
    );
    assert_eq!(results.get("run-2").expect("run-2 result").id, "result-2");
    assert!(results.get("missing-run").is_none());
}

#[test]
fn count_widget_logs_for_run_and_runs_is_scoped_to_widget() {
    let store = initialized_store();
    create_workspace_and_workbench(&store);
    insert_widget(&store);
    store
        .insert_widget_instance(NewWidgetInstance {
            id: "widget-2",
            workspace_id: "workspace-1",
            workbench_id: "workbench-1",
            definition_id: "terminal",
            title: "Terminal",
            category: "tool",
            layout_mode: "docked",
            dock_x: Some(0),
            dock_y: Some(0),
            dock_width: Some(320),
            dock_height: Some(200),
            popout_x: None,
            popout_y: None,
            popout_width: None,
            popout_height: None,
            always_on_top: false,
            is_visible: true,
            config: Some("{}"),
            state: Some("{}"),
        })
        .expect("insert second widget");
    insert_widget_run(&store);
    store
        .insert_widget_run(NewWidgetRun {
            id: "run-2",
            widget_instance_id: "widget-1",
            status: "completed",
            command_kind: Some("save_note"),
            command_payload: Some("{note:2}"),
            started_at: Some("3"),
            finished_at: Some("4"),
            summary: Some("Saved second note"),
        })
        .expect("insert second run");

    for (id, widget_id, run_id) in [
        ("log-1", "widget-1", "run-1"),
        ("log-2", "widget-1", "run-1"),
        ("log-3", "widget-1", "run-2"),
        ("cross-widget-log", "widget-2", "run-1"),
    ] {
        store
            .append_widget_log(NewWidgetLog {
                id,
                widget_instance_id: widget_id,
                run_id: Some(run_id),
                level: "info",
                message: "Run log",
                created_at: Some("5"),
                details: None,
            })
            .expect("append log");
    }

    let run_count = store
        .count_widget_logs_for_run("run-1", "widget-1")
        .expect("count run logs");
    let run_counts = store
        .count_widget_logs_for_runs_by_widget(
            &[
                "run-1".to_owned(),
                "run-2".to_owned(),
                "missing-run".to_owned(),
            ],
            "widget-1",
        )
        .expect("count logs for runs");

    assert_eq!(run_count, 2);
    assert_eq!(run_counts.get("run-1").copied(), Some(2));
    assert_eq!(run_counts.get("run-2").copied(), Some(1));
    assert_eq!(run_counts.get("missing-run").copied(), None);
}

#[test]
fn insert_and_list_agent_queue_items() {
    let store = initialized_store();
    create_workspace_and_workbench(&store);
    insert_widget(&store);
    insert_widget_run(&store);
    store
        .insert_widget_result(NewWidgetResult {
            id: "result-1",
            run_id: "run-1",
            status: "completed",
            result_type: Some("agent_chat_mock_proposal_result"),
            summary: Some("Proposal"),
            content: Some("Proposal content"),
            payload: Some("{\"runtime_status\":\"proposal_only_mock\"}"),
            created_at: Some("2"),
        })
        .expect("insert source result");

    let item = store
        .insert_agent_queue_item(NewAgentQueueItem {
            id: "queue-item-1",
            workspace_id: "workspace-1",
            workbench_id: "workbench-1",
            source_run_id: "run-1",
            source_result_id: "result-1",
            source_widget_instance_id: "widget-1",
            title: "Review proposal",
            status: "needs_review",
            payload_json: "{\"decision_status\":\"pending_review\"}",
            created_at: Some("3"),
            updated_at: Some("3"),
        })
        .expect("insert queue item");
    let listed = store
        .list_agent_queue_items("workspace-1", "workbench-1")
        .expect("list queue items");
    let other_workbench_items = store
        .list_agent_queue_items("workspace-1", "missing-workbench")
        .expect("list other workbench items");

    assert_eq!(item.status, "needs_review");
    assert_eq!(item.source_result_id, "result-1");
    assert_eq!(listed, vec![item]);
    assert!(other_workbench_items.is_empty());
}

#[test]
fn finish_widget_run_updates_status_and_preserves_existing_summary_when_absent() {
    let store = initialized_store();
    create_workspace_and_workbench(&store);
    insert_widget(&store);
    insert_widget_run(&store);

    let run = store
        .finish_widget_run(
            "run-1",
            WidgetRunFinishUpdate {
                status: "failed",
                finished_at: Some("3"),
                summary: None,
            },
        )
        .expect("finish run");
    let runs = store
        .list_widget_runs_for_widget("widget-1")
        .expect("list widget runs");

    assert_eq!(run.status, "failed");
    assert_eq!(run.finished_at.as_deref(), Some("3"));
    assert_eq!(run.summary.as_deref(), Some("Saved note"));
    assert_eq!(runs.len(), 1);
    assert_eq!(runs[0].id, "run-1");
}

#[test]
fn append_widget_local_log_without_run_id() {
    let store = initialized_store();
    create_workspace_and_workbench(&store);
    insert_widget(&store);

    let log = store
        .append_widget_log(NewWidgetLog {
            id: "log-1",
            widget_instance_id: "widget-1",
            run_id: None,
            level: "info",
            message: "Workspace context loaded",
            created_at: Some("1"),
            details: Some("{source:widget}"),
        })
        .expect("append widget-local log");
    let widget_logs = store
        .list_widget_logs_for_widget("widget-1", 100)
        .expect("list widget-local logs");

    assert_eq!(log.widget_instance_id, "widget-1");
    assert_eq!(log.run_id, None);
    assert_eq!(widget_logs.len(), 1);
    assert_eq!(widget_logs[0].id, "log-1");
}

#[test]
fn list_widget_logs_for_widget_does_not_leak_other_widget_logs() {
    let store = initialized_store();
    create_workspace_and_workbench(&store);
    insert_widget(&store);
    store
        .insert_widget_instance(NewWidgetInstance {
            id: "widget-2",
            workspace_id: "workspace-1",
            workbench_id: "workbench-1",
            definition_id: "notes",
            title: "Other Notes",
            category: "notes",
            layout_mode: "docked",
            dock_x: Some(0),
            dock_y: Some(0),
            dock_width: Some(360),
            dock_height: Some(240),
            popout_x: None,
            popout_y: None,
            popout_width: None,
            popout_height: None,
            always_on_top: false,
            is_visible: true,
            config: Some("{}"),
            state: Some("{}"),
        })
        .expect("insert second widget");

    for (id, widget_instance_id) in [("log-1", "widget-1"), ("log-2", "widget-2")] {
        store
            .append_widget_log(NewWidgetLog {
                id,
                widget_instance_id,
                run_id: None,
                level: "info",
                message: "Widget activity",
                created_at: Some("1"),
                details: None,
            })
            .expect("append widget log");
    }

    let logs = store
        .list_widget_logs_for_widget("widget-1", 100)
        .expect("list widget logs");

    assert_eq!(log_ids(&logs), vec!["log-1"]);
}

#[test]
fn list_widget_logs_for_widget_respects_limit_and_chronological_order() {
    let store = initialized_store();
    create_workspace_and_workbench(&store);
    insert_widget(&store);

    for (id, created_at) in [("log-1", "1"), ("log-c", "2"), ("log-a", "2")] {
        store
            .append_widget_log(NewWidgetLog {
                id,
                widget_instance_id: "widget-1",
                run_id: None,
                level: "info",
                message: "Widget activity",
                created_at: Some(created_at),
                details: None,
            })
            .expect("append widget log");
    }

    let logs = store
        .list_widget_logs_for_widget("widget-1", 2)
        .expect("list widget logs");

    assert_eq!(log_ids(&logs), vec!["log-a", "log-c"]);
}

#[test]
fn list_recent_widget_logs_for_run_respects_run_scope_limit_and_order() {
    let store = initialized_store();
    create_workspace_and_workbench(&store);
    insert_widget(&store);
    insert_widget_run(&store);
    store
        .insert_widget_run(NewWidgetRun {
            id: "run-2",
            widget_instance_id: "widget-1",
            status: "completed",
            command_kind: Some("save_note"),
            command_payload: None,
            started_at: Some("2"),
            finished_at: Some("3"),
            summary: Some("Saved other note"),
        })
        .expect("insert second run");

    for (id, run_id, created_at) in [
        ("log-1", "run-1", "1"),
        ("log-c", "run-1", "2"),
        ("log-a", "run-1", "2"),
        ("other-run-log", "run-2", "3"),
    ] {
        store
            .append_widget_log(NewWidgetLog {
                id,
                widget_instance_id: "widget-1",
                run_id: Some(run_id),
                level: "info",
                message: "Run activity",
                created_at: Some(created_at),
                details: None,
            })
            .expect("append run log");
    }

    let logs = store
        .list_recent_widget_logs_for_run("run-1", 2)
        .expect("list recent run logs");

    assert_eq!(log_ids(&logs), vec!["log-a", "log-c"]);
    assert!(logs
        .iter()
        .all(|log| log.run_id.as_deref() == Some("run-1")));
}

fn event_ids(events: &[WorkbenchEventRow]) -> Vec<&str> {
    events.iter().map(|event| event.id.as_str()).collect()
}

fn log_ids(logs: &[WidgetLogRow]) -> Vec<&str> {
    logs.iter().map(|log| log.id.as_str()).collect()
}

fn run_ids(runs: &[WidgetRunRow]) -> Vec<&str> {
    runs.iter().map(|run| run.id.as_str()).collect()
}
