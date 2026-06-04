use rusqlite::{params, OptionalExtension, Result};

use crate::inputs::{KnowledgeDocumentUpdate, NewKnowledgeDocument};
use crate::mappers::{bool_to_i64, knowledge_document_chunk_row, knowledge_document_row};
use crate::rows::{
    KnowledgeDocumentChunkRow, KnowledgeDocumentRow, KnowledgeDocumentSearchResultRow,
};
use crate::time::now_precise_timestamp;

use super::{
    knowledge_search::{
        capped_search_limit, chunk_knowledge_document_content, knowledge_search_score,
        lexical_terms, sort_knowledge_search_results,
    },
    SqliteStore,
};

const KNOWLEDGE_DOCUMENT_SCOPE_GLOBAL: &str = "global";
const KNOWLEDGE_DOCUMENT_SCOPE_WORKSPACE: &str = "workspace";

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
                    content TEXT NOT NULL,
                    tags TEXT NOT NULL,
                    enabled INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
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
                    source_kind, source_ref, content, tags, enabled, created_at,
                    updated_at
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
                    content,
                    tags,
                    enabled,
                    created_at,
                    updated_at
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
        Ok(())
    }

    pub fn create_knowledge_document(
        &self,
        input: NewKnowledgeDocument<'_>,
    ) -> Result<KnowledgeDocumentRow> {
        let created_at = input
            .created_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);
        let updated_at = input
            .updated_at
            .map(str::to_owned)
            .unwrap_or_else(|| created_at.clone());

        let scope = normalized_knowledge_document_scope(input.scope);
        let owner_workspace_id = knowledge_document_owner_workspace_id(input.workspace_id, scope);
        let catalog_item_type = input.catalog_item_type.unwrap_or("documentation_knowledge");
        let quick_summary = input.quick_summary.unwrap_or("");
        let lifecycle_status = input.lifecycle_status.unwrap_or("active");
        let source_kind = input.source_kind.unwrap_or("operator_authored");
        let source_ref = input.source_ref.unwrap_or("");

        self.connection.execute(
            "INSERT INTO knowledge_documents (
                knowledge_document_id, workspace_id, scope, catalog_item_type,
                quick_summary, lifecycle_status, title, source_label,
                source_kind, source_ref, content, tags, enabled, created_at,
                updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![
                input.knowledge_document_id,
                owner_workspace_id,
                scope,
                catalog_item_type,
                quick_summary,
                lifecycle_status,
                input.title,
                input.source_label,
                source_kind,
                source_ref,
                input.content,
                input.tags,
                bool_to_i64(input.enabled),
                created_at,
                updated_at,
            ],
        )?;
        self.replace_knowledge_document_chunks(
            owner_workspace_id,
            scope,
            input.knowledge_document_id,
            input.content,
            &created_at,
        )?;

        self.get_knowledge_document(input.workspace_id, input.knowledge_document_id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn list_knowledge_documents_for_workspace(
        &self,
        workspace_id: &str,
    ) -> Result<Vec<KnowledgeDocumentRow>> {
        let mut statement = self.connection.prepare(
            "SELECT knowledge_document_id, COALESCE(workspace_id, ''), scope,
                    catalog_item_type, quick_summary, lifecycle_status, title,
                    source_label, source_kind, source_ref, content, tags,
                    enabled, created_at, updated_at
             FROM knowledge_documents
             WHERE (scope = 'workspace' AND workspace_id = ?1)
                OR scope = 'global'
             ORDER BY updated_at DESC, created_at DESC, knowledge_document_id DESC",
        )?;

        let rows = statement.query_map(params![workspace_id], knowledge_document_row)?;
        rows.collect()
    }

    pub fn get_knowledge_document(
        &self,
        workspace_id: &str,
        knowledge_document_id: &str,
    ) -> Result<Option<KnowledgeDocumentRow>> {
        self.connection
            .query_row(
                "SELECT knowledge_document_id, COALESCE(workspace_id, ''), scope,
                        catalog_item_type, quick_summary, lifecycle_status, title,
                        source_label, source_kind, source_ref, content, tags,
                        enabled, created_at, updated_at
                 FROM knowledge_documents
                 WHERE knowledge_document_id = ?2
                    AND (
                        (scope = 'workspace' AND workspace_id = ?1)
                        OR scope = 'global'
                    )",
                params![workspace_id, knowledge_document_id],
                knowledge_document_row,
            )
            .optional()
    }

    pub fn get_knowledge_document_by_id(
        &self,
        knowledge_document_id: &str,
    ) -> Result<Option<KnowledgeDocumentRow>> {
        self.connection
            .query_row(
                "SELECT knowledge_document_id, COALESCE(workspace_id, ''), scope,
                        catalog_item_type, quick_summary, lifecycle_status, title,
                        source_label, source_kind, source_ref, content, tags,
                        enabled, created_at, updated_at
                 FROM knowledge_documents
                 WHERE knowledge_document_id = ?1",
                params![knowledge_document_id],
                knowledge_document_row,
            )
            .optional()
    }

    pub fn update_knowledge_document(
        &self,
        workspace_id: &str,
        knowledge_document_id: &str,
        update: KnowledgeDocumentUpdate<'_>,
    ) -> Result<Option<KnowledgeDocumentRow>> {
        let updated_at = update
            .updated_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);
        let scope = normalized_knowledge_document_scope(update.scope);
        let owner_workspace_id = knowledge_document_owner_workspace_id(workspace_id, scope);
        let catalog_item_type = update
            .catalog_item_type
            .unwrap_or("documentation_knowledge");
        let quick_summary = update.quick_summary.unwrap_or("");
        let lifecycle_status = update.lifecycle_status.unwrap_or("active");
        let source_kind = update.source_kind.unwrap_or("operator_authored");
        let source_ref = update.source_ref.unwrap_or("");
        let affected_rows = self.connection.execute(
            "UPDATE knowledge_documents
             SET workspace_id = ?1,
                 scope = ?2,
                 catalog_item_type = ?3,
                 quick_summary = ?4,
                 lifecycle_status = ?5,
                 title = ?6,
                 source_label = ?7,
                 source_kind = ?8,
                 source_ref = ?9,
                 content = ?10,
                 tags = ?11,
                 enabled = ?12,
                 updated_at = ?13
             WHERE knowledge_document_id = ?14
                AND (
                    (scope = 'workspace' AND workspace_id = ?15)
                    OR scope = 'global'
                )",
            params![
                owner_workspace_id,
                scope,
                catalog_item_type,
                quick_summary,
                lifecycle_status,
                update.title,
                update.source_label,
                source_kind,
                source_ref,
                update.content,
                update.tags,
                bool_to_i64(update.enabled),
                updated_at,
                knowledge_document_id,
                workspace_id,
            ],
        )?;

        if affected_rows == 0 {
            return Ok(None);
        }

        self.replace_knowledge_document_chunks(
            owner_workspace_id,
            scope,
            knowledge_document_id,
            update.content,
            &updated_at,
        )?;

        self.get_knowledge_document(workspace_id, knowledge_document_id)
    }

    pub fn delete_knowledge_document(
        &self,
        workspace_id: &str,
        knowledge_document_id: &str,
    ) -> Result<bool> {
        self.connection.execute(
            "DELETE FROM knowledge_document_chunks
             WHERE knowledge_document_id = ?2
                AND (
                    (scope = 'workspace' AND workspace_id = ?1)
                    OR scope = 'global'
                )",
            params![workspace_id, knowledge_document_id],
        )?;
        let affected_rows = self.connection.execute(
            "DELETE FROM knowledge_documents
             WHERE knowledge_document_id = ?2
                AND (
                    (scope = 'workspace' AND workspace_id = ?1)
                    OR scope = 'global'
                )",
            params![workspace_id, knowledge_document_id],
        )?;

        Ok(affected_rows > 0)
    }

    pub fn list_knowledge_document_chunks(
        &self,
        workspace_id: &str,
        knowledge_document_id: &str,
    ) -> Result<Vec<KnowledgeDocumentChunkRow>> {
        let mut statement = self.connection.prepare(
            "SELECT chunk_id, knowledge_document_id, COALESCE(workspace_id, ''),
                    scope, chunk_index, text, created_at
             FROM knowledge_document_chunks
             WHERE knowledge_document_id = ?2
                AND (
                    (scope = 'workspace' AND workspace_id = ?1)
                    OR scope = 'global'
                )
             ORDER BY chunk_index ASC",
        )?;

        let rows = statement.query_map(
            params![workspace_id, knowledge_document_id],
            knowledge_document_chunk_row,
        )?;
        rows.collect()
    }

    pub fn search_knowledge_documents(
        &self,
        workspace_id: &str,
        query: &str,
        limit: usize,
    ) -> Result<Vec<KnowledgeDocumentSearchResultRow>> {
        let terms = lexical_terms(query);
        if terms.is_empty() {
            return Ok(Vec::new());
        }

        let mut statement = self.connection.prepare(
            "SELECT
                knowledge_documents.knowledge_document_id,
                knowledge_documents.title,
                knowledge_documents.scope,
                knowledge_documents.source_label,
                knowledge_documents.tags,
                knowledge_document_chunks.chunk_id,
                knowledge_document_chunks.chunk_index,
                knowledge_document_chunks.text
             FROM knowledge_document_chunks
             INNER JOIN knowledge_documents
                ON knowledge_documents.knowledge_document_id =
                    knowledge_document_chunks.knowledge_document_id
             WHERE (
                    (
                        knowledge_documents.scope = 'workspace'
                        AND knowledge_documents.workspace_id = ?1
                        AND knowledge_document_chunks.workspace_id = ?1
                    )
                    OR (
                        knowledge_documents.scope = 'global'
                        AND knowledge_document_chunks.scope = 'global'
                    )
                )
                AND knowledge_documents.enabled = 1
                AND knowledge_documents.lifecycle_status = 'active'",
        )?;

        let rows = statement.query_map(params![workspace_id], |row| {
            Ok(KnowledgeDocumentSearchResultRow {
                knowledge_document_id: row.get(0)?,
                document_title: row.get(1)?,
                scope: row.get(2)?,
                source_label: row.get(3)?,
                tags: row.get(4)?,
                chunk_id: row.get(5)?,
                chunk_index: row.get(6)?,
                text: row.get(7)?,
                score: 0,
            })
        })?;
        let capped_limit = capped_search_limit(limit);
        let mut results = rows
            .collect::<Result<Vec<_>>>()?
            .into_iter()
            .filter_map(|mut row| {
                row.score = knowledge_search_score(&row, &terms);
                (row.score > 0).then_some(row)
            })
            .collect::<Vec<_>>();

        sort_knowledge_search_results(&mut results);
        results.truncate(capped_limit);
        Ok(results)
    }

    fn replace_knowledge_document_chunks(
        &self,
        workspace_id: Option<&str>,
        scope: &str,
        knowledge_document_id: &str,
        content: &str,
        created_at: &str,
    ) -> Result<()> {
        self.connection.execute(
            "DELETE FROM knowledge_document_chunks
             WHERE knowledge_document_id = ?1",
            params![knowledge_document_id],
        )?;

        for (chunk_index, text) in chunk_knowledge_document_content(content)
            .into_iter()
            .enumerate()
        {
            let chunk_id = format!("{knowledge_document_id}_chunk_{chunk_index:04}");
            self.connection.execute(
                "INSERT INTO knowledge_document_chunks (
                    chunk_id, knowledge_document_id, workspace_id, scope,
                    chunk_index, text, created_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    chunk_id,
                    knowledge_document_id,
                    workspace_id,
                    scope,
                    chunk_index as i64,
                    text,
                    created_at,
                ],
            )?;
        }

        Ok(())
    }
}

fn normalized_knowledge_document_scope(scope: Option<&str>) -> &str {
    match scope.map(str::trim) {
        Some(KNOWLEDGE_DOCUMENT_SCOPE_GLOBAL) => KNOWLEDGE_DOCUMENT_SCOPE_GLOBAL,
        _ => KNOWLEDGE_DOCUMENT_SCOPE_WORKSPACE,
    }
}

fn knowledge_document_owner_workspace_id<'a>(
    workspace_id: &'a str,
    scope: &str,
) -> Option<&'a str> {
    match scope {
        KNOWLEDGE_DOCUMENT_SCOPE_GLOBAL => None,
        _ => Some(workspace_id),
    }
}
