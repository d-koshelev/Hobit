use rusqlite::Result;

use super::SqliteStore;

impl SqliteStore {
    pub(super) fn upgrade_knowledge_documents_schema(&self) -> Result<()> {
        let document_columns = self.table_columns("knowledge_documents")?;
        let chunk_columns = self.table_columns("knowledge_document_chunks")?;
        let document_has_scope = document_columns.iter().any(|column| column.name == "scope");
        let chunks_have_scope = chunk_columns.iter().any(|column| column.name == "scope");
        let document_workspace_not_null = document_columns
            .iter()
            .find(|column| column.name == "workspace_id")
            .is_some_and(|column| column.not_null);
        let chunk_workspace_not_null = chunk_columns
            .iter()
            .find(|column| column.name == "workspace_id")
            .is_some_and(|column| column.not_null);

        if !document_has_scope
            || !chunks_have_scope
            || document_workspace_not_null
            || chunk_workspace_not_null
        {
            let document_scope_expression = if document_has_scope {
                "COALESCE(scope, 'workspace')"
            } else {
                "'workspace'"
            };
            let chunk_scope_expression = if chunks_have_scope {
                "COALESCE(scope, 'workspace')"
            } else {
                "'workspace'"
            };

            let sql = format!(
                r#"
                DROP TABLE IF EXISTS knowledge_document_versions;
                ALTER TABLE knowledge_document_chunks RENAME TO knowledge_document_chunks_legacy;
                ALTER TABLE knowledge_documents RENAME TO knowledge_documents_legacy;

                CREATE TABLE knowledge_documents (
                    knowledge_document_id TEXT PRIMARY KEY,
                    workspace_id TEXT NULL REFERENCES workspaces(id),
                    scope TEXT NOT NULL DEFAULT 'workspace',
                    catalog_item_type TEXT NOT NULL DEFAULT 'documentation_knowledge',
                    quick_summary TEXT NOT NULL DEFAULT '',
                    lifecycle_status TEXT NOT NULL DEFAULT 'active',
                    title TEXT NOT NULL,
                    source_label TEXT NOT NULL,
                    source_kind TEXT NOT NULL DEFAULT 'operator_authored',
                    source_ref TEXT NOT NULL DEFAULT '',
                    source_refs TEXT NOT NULL DEFAULT '[]',
                    relations TEXT NOT NULL DEFAULT '[]',
                    content TEXT NOT NULL,
                    tags TEXT NOT NULL,
                    enabled INTEGER NOT NULL DEFAULT 1,
                    searchable INTEGER NOT NULL DEFAULT 1,
                    version INTEGER NOT NULL DEFAULT 1,
                    version_summary TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    reviewed_at TEXT NULL,
                    created_by_task_id TEXT NULL,
                    created_from_run_id TEXT NULL
                );

                CREATE TABLE knowledge_document_chunks (
                    chunk_id TEXT PRIMARY KEY,
                    knowledge_document_id TEXT NOT NULL REFERENCES knowledge_documents(knowledge_document_id) ON DELETE CASCADE,
                    workspace_id TEXT NULL REFERENCES workspaces(id),
                    scope TEXT NOT NULL DEFAULT 'workspace',
                    chunk_index INTEGER NOT NULL,
                    text TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );

                INSERT INTO knowledge_documents (
                    knowledge_document_id, workspace_id, scope, catalog_item_type,
                    quick_summary, lifecycle_status, title, source_label,
                    source_kind, source_ref, source_refs, relations, content,
                    tags, enabled, searchable, version, version_summary,
                    created_at, updated_at, reviewed_at, created_by_task_id,
                    created_from_run_id
                )
                SELECT
                    knowledge_document_id,
                    workspace_id,
                    {document_scope_expression},
                    'documentation_knowledge',
                    '',
                    'active',
                    title,
                    source_label,
                    'operator_authored',
                    '',
                    '[]',
                    '[]',
                    content,
                    tags,
                    enabled,
                    1,
                    1,
                    '',
                    created_at,
                    updated_at,
                    NULL,
                    NULL,
                    NULL
                FROM knowledge_documents_legacy;

                INSERT INTO knowledge_document_chunks (
                    chunk_id, knowledge_document_id, workspace_id, scope,
                    chunk_index, text, created_at
                )
                SELECT
                    chunk_id,
                    knowledge_document_id,
                    workspace_id,
                    {chunk_scope_expression},
                    chunk_index,
                    text,
                    created_at
                FROM knowledge_document_chunks_legacy;

                DROP TABLE knowledge_document_chunks_legacy;
                DROP TABLE knowledge_documents_legacy;
                "#
            );

            self.connection.execute_batch(&sql)?;
        }

        self.ensure_knowledge_document_catalog_columns()?;
        self.ensure_knowledge_document_versions_table()?;
        Ok(())
    }

    fn ensure_knowledge_document_catalog_columns(&self) -> Result<()> {
        self.ensure_column(
            "knowledge_documents",
            "catalog_item_type",
            "catalog_item_type TEXT NOT NULL DEFAULT 'documentation_knowledge'",
        )?;
        self.ensure_column(
            "knowledge_documents",
            "quick_summary",
            "quick_summary TEXT NOT NULL DEFAULT ''",
        )?;
        self.ensure_column(
            "knowledge_documents",
            "lifecycle_status",
            "lifecycle_status TEXT NOT NULL DEFAULT 'active'",
        )?;
        self.ensure_column(
            "knowledge_documents",
            "source_kind",
            "source_kind TEXT NOT NULL DEFAULT 'operator_authored'",
        )?;
        self.ensure_column(
            "knowledge_documents",
            "source_ref",
            "source_ref TEXT NOT NULL DEFAULT ''",
        )?;
        self.ensure_column(
            "knowledge_documents",
            "source_refs",
            "source_refs TEXT NOT NULL DEFAULT '[]'",
        )?;
        self.ensure_column(
            "knowledge_documents",
            "relations",
            "relations TEXT NOT NULL DEFAULT '[]'",
        )?;
        self.ensure_column(
            "knowledge_documents",
            "searchable",
            "searchable INTEGER NOT NULL DEFAULT 1",
        )?;
        self.ensure_column(
            "knowledge_documents",
            "version",
            "version INTEGER NOT NULL DEFAULT 1",
        )?;
        self.ensure_column(
            "knowledge_documents",
            "version_summary",
            "version_summary TEXT NOT NULL DEFAULT ''",
        )?;
        self.ensure_column(
            "knowledge_documents",
            "reviewed_at",
            "reviewed_at TEXT NULL",
        )?;
        self.ensure_column(
            "knowledge_documents",
            "created_by_task_id",
            "created_by_task_id TEXT NULL",
        )?;
        self.ensure_column(
            "knowledge_documents",
            "created_from_run_id",
            "created_from_run_id TEXT NULL",
        )?;
        Ok(())
    }

    fn ensure_knowledge_document_versions_table(&self) -> Result<()> {
        self.connection.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS knowledge_document_versions (
                knowledge_document_version_id TEXT PRIMARY KEY,
                knowledge_document_id TEXT NOT NULL REFERENCES knowledge_documents(knowledge_document_id) ON DELETE CASCADE,
                version INTEGER NOT NULL,
                version_summary TEXT NOT NULL DEFAULT '',
                lifecycle_status TEXT NOT NULL,
                source_refs TEXT NOT NULL DEFAULT '[]',
                relations TEXT NOT NULL DEFAULT '[]',
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_knowledge_document_versions_document_id
                ON knowledge_document_versions(knowledge_document_id, version);
            "#,
        )?;
        Ok(())
    }
}
