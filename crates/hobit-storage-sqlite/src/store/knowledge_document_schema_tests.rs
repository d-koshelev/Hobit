use super::*;

#[test]
fn init_schema_upgrades_knowledge_document_scope_columns() {
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

                CREATE TABLE knowledge_documents (
                    knowledge_document_id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
                    title TEXT NOT NULL,
                    source_label TEXT NOT NULL,
                    content TEXT NOT NULL,
                    tags TEXT NOT NULL,
                    enabled INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE knowledge_document_chunks (
                    chunk_id TEXT PRIMARY KEY,
                    knowledge_document_id TEXT NOT NULL REFERENCES knowledge_documents(knowledge_document_id) ON DELETE CASCADE,
                    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
                    chunk_index INTEGER NOT NULL,
                    text TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );

                INSERT INTO workspaces (
                    id, title, description, status, created_at, updated_at
                ) VALUES (
                    'workspace-1', 'Workspace', NULL, 'active', '1', '1'
                );

                INSERT INTO knowledge_documents (
                    knowledge_document_id, workspace_id, title, source_label,
                    content, tags, enabled, created_at, updated_at
                ) VALUES (
                    'doc-legacy', 'workspace-1', 'Legacy doc', 'Legacy source',
                    'Legacy content', 'legacy', 1, '1', '1'
                );

                INSERT INTO knowledge_document_chunks (
                    chunk_id, knowledge_document_id, workspace_id, chunk_index,
                    text, created_at
                ) VALUES (
                    'doc-legacy_chunk_0000', 'doc-legacy', 'workspace-1', 0,
                    'Legacy content', '1'
                );
                "#,
        )
        .expect("create legacy knowledge document tables");

    store.init_schema().expect("upgrade schema");

    let legacy = store
        .get_knowledge_document("workspace-1", "doc-legacy")
        .expect("get upgraded document")
        .expect("upgraded document");
    let chunks = store
        .list_knowledge_document_chunks("workspace-1", "doc-legacy")
        .expect("list upgraded chunks");
    let global = store
        .create_knowledge_document(NewKnowledgeDocument {
            knowledge_document_id: "doc-global",
            workspace_id: "workspace-1",
            scope: Some("global"),
            catalog_item_type: None,
            quick_summary: None,
            lifecycle_status: None,
            title: "Global doc",
            source_label: "Global source",
            source_kind: None,
            source_ref: None,
            content: "Global content",
            tags: "",
            enabled: true,
            created_at: Some("2"),
            updated_at: Some("2"),
        })
        .expect("create global document after upgrade");

    assert_eq!(legacy.scope, "workspace");
    assert_eq!(chunks[0].scope, "workspace");
    assert_eq!(global.scope, "global");
    assert_eq!(global.workspace_id, "");
}
