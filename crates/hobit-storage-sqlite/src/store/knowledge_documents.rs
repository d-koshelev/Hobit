use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, OptionalExtension, Result};

use crate::inputs::{
    KnowledgeDocumentSearchFilters, KnowledgeDocumentUpdate, NewKnowledgeDocument,
};
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
        let source_refs = input.source_refs.unwrap_or("[]");
        let relations = input.relations.unwrap_or("[]");
        let version_summary = input.version_summary.unwrap_or("");
        let reviewed_at = input
            .reviewed_at
            .or_else(|| reviewed_timestamp_for_status(lifecycle_status, &created_at));

        self.connection.execute(
            "INSERT INTO knowledge_documents (
                knowledge_document_id, workspace_id, scope, catalog_item_type,
                quick_summary, lifecycle_status, title, source_label,
                source_kind, source_ref, source_refs, relations, content, tags,
                enabled, searchable, version, version_summary, created_at,
                updated_at, reviewed_at, created_by_task_id, created_from_run_id
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13,
                ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23
            )",
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
                source_refs,
                relations,
                input.content,
                input.tags,
                bool_to_i64(input.enabled),
                bool_to_i64(input.searchable),
                1_i64,
                version_summary,
                created_at,
                updated_at,
                reviewed_at,
                input.created_by_task_id,
                input.created_from_run_id,
            ],
        )?;
        self.insert_knowledge_document_version(
            input.knowledge_document_id,
            1,
            version_summary,
            lifecycle_status,
            source_refs,
            relations,
            input.content,
            &created_at,
            &updated_at,
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
                    source_label, source_kind, source_ref, source_refs,
                    relations, content, tags, enabled, searchable, version,
                    version_summary, created_at, updated_at, reviewed_at,
                    created_by_task_id, created_from_run_id
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
                        source_label, source_kind, source_ref, source_refs,
                        relations, content, tags, enabled, searchable, version,
                        version_summary, created_at, updated_at, reviewed_at,
                        created_by_task_id, created_from_run_id
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
                        source_label, source_kind, source_ref, source_refs,
                        relations, content, tags, enabled, searchable, version,
                        version_summary, created_at, updated_at, reviewed_at,
                        created_by_task_id, created_from_run_id
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
        let source_refs = update.source_refs.unwrap_or("[]");
        let relations = update.relations.unwrap_or("[]");
        let version_summary = update.version_summary.unwrap_or("");
        let current = self.get_knowledge_document(workspace_id, knowledge_document_id)?;
        let next_version = current.as_ref().map_or(1, |document| document.version + 1);
        let reviewed_at = update.reviewed_at.or_else(|| {
            current
                .as_ref()
                .and_then(|document| document.reviewed_at.as_deref())
                .or_else(|| reviewed_timestamp_for_status(lifecycle_status, &updated_at))
        });
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
                 source_refs = ?10,
                 relations = ?11,
                 content = ?12,
                 tags = ?13,
                 enabled = ?14,
                 searchable = ?15,
                 version = ?16,
                 version_summary = ?17,
                 updated_at = ?18,
                 reviewed_at = ?19,
                 created_by_task_id = ?20,
                 created_from_run_id = ?21
             WHERE knowledge_document_id = ?22
                AND (
                    (scope = 'workspace' AND workspace_id = ?23)
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
                source_refs,
                relations,
                update.content,
                update.tags,
                bool_to_i64(update.enabled),
                bool_to_i64(update.searchable),
                next_version,
                version_summary,
                updated_at,
                reviewed_at,
                update.created_by_task_id.or_else(|| {
                    current
                        .as_ref()
                        .and_then(|document| document.created_by_task_id.as_deref())
                }),
                update.created_from_run_id.or_else(|| {
                    current
                        .as_ref()
                        .and_then(|document| document.created_from_run_id.as_deref())
                }),
                knowledge_document_id,
                workspace_id,
            ],
        )?;

        if affected_rows == 0 {
            return Ok(None);
        }

        self.insert_knowledge_document_version(
            knowledge_document_id,
            next_version,
            version_summary,
            lifecycle_status,
            source_refs,
            relations,
            update.content,
            &updated_at,
            &updated_at,
        )?;
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
        self.search_knowledge_documents_with_filters(
            workspace_id,
            query,
            limit,
            &KnowledgeDocumentSearchFilters::default(),
        )
    }

    pub fn search_knowledge_documents_with_filters(
        &self,
        workspace_id: &str,
        query: &str,
        limit: usize,
        filters: &KnowledgeDocumentSearchFilters,
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
                knowledge_documents.catalog_item_type,
                knowledge_documents.lifecycle_status,
                knowledge_documents.source_label,
                knowledge_documents.source_kind,
                knowledge_documents.tags,
                knowledge_documents.updated_at,
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
                AND knowledge_documents.searchable = 1
                AND knowledge_documents.lifecycle_status = 'active'",
        )?;

        let rows = statement.query_map(params![workspace_id], |row| {
            Ok(KnowledgeDocumentSearchResultRow {
                knowledge_document_id: row.get(0)?,
                document_title: row.get(1)?,
                scope: row.get(2)?,
                catalog_item_type: row.get(3)?,
                lifecycle_status: row.get(4)?,
                source_label: row.get(5)?,
                source_kind: row.get(6)?,
                tags: row.get(7)?,
                updated_at: row.get(8)?,
                chunk_id: row.get(9)?,
                chunk_index: row.get(10)?,
                text: row.get(11)?,
                score: 0,
            })
        })?;
        let capped_limit = capped_search_limit(limit);
        let mut results = rows
            .collect::<Result<Vec<_>>>()?
            .into_iter()
            .filter(|row| knowledge_search_result_matches_filters(row, filters))
            .filter_map(|mut row| {
                row.score = knowledge_search_score(&row, &terms);
                (row.score > 0).then_some(row)
            })
            .collect::<Vec<_>>();

        sort_knowledge_search_results(&mut results);
        results.truncate(capped_limit);
        Ok(results)
    }

    fn insert_knowledge_document_version(
        &self,
        knowledge_document_id: &str,
        version: i64,
        version_summary: &str,
        lifecycle_status: &str,
        source_refs: &str,
        relations: &str,
        content: &str,
        created_at: &str,
        updated_at: &str,
    ) -> Result<()> {
        let knowledge_document_version_id = format!("{knowledge_document_id}_v{version:06}");
        self.connection.execute(
            "INSERT OR REPLACE INTO knowledge_document_versions (
                knowledge_document_version_id, knowledge_document_id, version,
                version_summary, lifecycle_status, source_refs, relations,
                content, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                knowledge_document_version_id,
                knowledge_document_id,
                version,
                version_summary,
                lifecycle_status,
                source_refs,
                relations,
                content,
                created_at,
                updated_at,
            ],
        )?;

        Ok(())
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

fn knowledge_search_result_matches_filters(
    row: &KnowledgeDocumentSearchResultRow,
    filters: &KnowledgeDocumentSearchFilters,
) -> bool {
    string_filter_matches(&filters.scopes, &row.scope)
        && string_filter_matches(&filters.catalog_item_types, &row.catalog_item_type)
        && string_filter_matches(&filters.lifecycle_statuses, &row.lifecycle_status)
        && tags_filter_matches(&filters.tags, &row.tags)
        && string_filter_matches(&filters.source_kinds, &row.source_kind)
        && updated_filter_matches(row, filters)
}

fn string_filter_matches(accepted_values: &[String], value: &str) -> bool {
    accepted_values.is_empty()
        || accepted_values
            .iter()
            .any(|accepted| accepted.eq_ignore_ascii_case(value))
}

fn tags_filter_matches(required_tags: &[String], document_tags: &str) -> bool {
    if required_tags.is_empty() {
        return true;
    }

    let tags = document_tags
        .split(',')
        .map(|tag| tag.trim().to_ascii_lowercase())
        .filter(|tag| !tag.is_empty())
        .collect::<Vec<_>>();
    required_tags
        .iter()
        .all(|required| tags.iter().any(|tag| tag == required))
}

fn updated_filter_matches(
    row: &KnowledgeDocumentSearchResultRow,
    filters: &KnowledgeDocumentSearchFilters,
) -> bool {
    let Some(updated_at) = parse_timestamp(&row.updated_at) else {
        return filters.updated_after.is_none() && filters.updated_within_days.is_none();
    };

    if filters
        .updated_after
        .as_deref()
        .and_then(parse_timestamp)
        .is_some_and(|cutoff| updated_at < cutoff)
    {
        return false;
    }

    if let Some(recent_days) = filters.updated_within_days {
        let cutoff = now_unix_seconds().saturating_sub(u64::from(recent_days) * 86_400);
        if updated_at < cutoff as f64 {
            return false;
        }
    }

    true
}

fn parse_timestamp(value: &str) -> Option<f64> {
    value.trim().parse::<f64>().ok()
}

fn now_unix_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
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

fn reviewed_timestamp_for_status<'a>(
    lifecycle_status: &str,
    timestamp: &'a str,
) -> Option<&'a str> {
    matches!(lifecycle_status, "active" | "rejected").then_some(timestamp)
}
