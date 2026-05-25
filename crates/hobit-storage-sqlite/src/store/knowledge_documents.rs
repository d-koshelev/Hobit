use rusqlite::{params, OptionalExtension, Result};

use crate::inputs::{KnowledgeDocumentUpdate, NewKnowledgeDocument};
use crate::mappers::{bool_to_i64, knowledge_document_chunk_row, knowledge_document_row};
use crate::rows::{
    KnowledgeDocumentChunkRow, KnowledgeDocumentRow, KnowledgeDocumentSearchResultRow,
};
use crate::time::now_precise_timestamp;

use super::SqliteStore;

const TARGET_CHUNK_CHARS: usize = 1_600;
const MAX_CHUNK_CHARS: usize = 2_000;
const MIN_CHUNK_CHARS: usize = 1_000;
const MAX_SEARCH_LIMIT: usize = 20;

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

        self.connection.execute(
            "INSERT INTO knowledge_documents (
                knowledge_document_id, workspace_id, title, source_label, content,
                tags, enabled, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                input.knowledge_document_id,
                input.workspace_id,
                input.title,
                input.source_label,
                input.content,
                input.tags,
                bool_to_i64(input.enabled),
                created_at,
                updated_at,
            ],
        )?;
        self.replace_knowledge_document_chunks(
            input.workspace_id,
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
            "SELECT knowledge_document_id, workspace_id, title, source_label, content,
                    tags, enabled, created_at, updated_at
             FROM knowledge_documents
             WHERE workspace_id = ?1
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
                "SELECT knowledge_document_id, workspace_id, title, source_label, content,
                        tags, enabled, created_at, updated_at
                 FROM knowledge_documents
                 WHERE workspace_id = ?1 AND knowledge_document_id = ?2",
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
                "SELECT knowledge_document_id, workspace_id, title, source_label, content,
                        tags, enabled, created_at, updated_at
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
        let affected_rows = self.connection.execute(
            "UPDATE knowledge_documents
             SET title = ?1,
                 source_label = ?2,
                 content = ?3,
                 tags = ?4,
                 enabled = ?5,
                 updated_at = ?6
             WHERE workspace_id = ?7 AND knowledge_document_id = ?8",
            params![
                update.title,
                update.source_label,
                update.content,
                update.tags,
                bool_to_i64(update.enabled),
                updated_at,
                workspace_id,
                knowledge_document_id,
            ],
        )?;

        if affected_rows == 0 {
            return Ok(None);
        }

        self.replace_knowledge_document_chunks(
            workspace_id,
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
             WHERE workspace_id = ?1 AND knowledge_document_id = ?2",
            params![workspace_id, knowledge_document_id],
        )?;
        let affected_rows = self.connection.execute(
            "DELETE FROM knowledge_documents
             WHERE workspace_id = ?1 AND knowledge_document_id = ?2",
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
            "SELECT chunk_id, knowledge_document_id, workspace_id, chunk_index, text, created_at
             FROM knowledge_document_chunks
             WHERE workspace_id = ?1 AND knowledge_document_id = ?2
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
                knowledge_documents.source_label,
                knowledge_documents.tags,
                knowledge_document_chunks.chunk_id,
                knowledge_document_chunks.chunk_index,
                knowledge_document_chunks.text
             FROM knowledge_document_chunks
             INNER JOIN knowledge_documents
                ON knowledge_documents.knowledge_document_id =
                    knowledge_document_chunks.knowledge_document_id
             WHERE knowledge_documents.workspace_id = ?1
                AND knowledge_document_chunks.workspace_id = ?1
                AND knowledge_documents.enabled = 1",
        )?;

        let rows = statement.query_map(params![workspace_id], |row| {
            Ok(KnowledgeDocumentSearchResultRow {
                knowledge_document_id: row.get(0)?,
                document_title: row.get(1)?,
                source_label: row.get(2)?,
                tags: row.get(3)?,
                chunk_id: row.get(4)?,
                chunk_index: row.get(5)?,
                text: row.get(6)?,
                score: 0,
            })
        })?;
        let capped_limit = limit.clamp(1, MAX_SEARCH_LIMIT);
        let mut results = rows
            .collect::<Result<Vec<_>>>()?
            .into_iter()
            .filter_map(|mut row| {
                row.score = knowledge_search_score(&row, &terms);
                (row.score > 0).then_some(row)
            })
            .collect::<Vec<_>>();

        results.sort_by(|left, right| {
            right
                .score
                .cmp(&left.score)
                .then_with(|| left.document_title.cmp(&right.document_title))
                .then_with(|| left.chunk_index.cmp(&right.chunk_index))
        });
        results.truncate(capped_limit);
        Ok(results)
    }

    fn replace_knowledge_document_chunks(
        &self,
        workspace_id: &str,
        knowledge_document_id: &str,
        content: &str,
        created_at: &str,
    ) -> Result<()> {
        self.connection.execute(
            "DELETE FROM knowledge_document_chunks
             WHERE workspace_id = ?1 AND knowledge_document_id = ?2",
            params![workspace_id, knowledge_document_id],
        )?;

        for (chunk_index, text) in chunk_knowledge_document_content(content)
            .into_iter()
            .enumerate()
        {
            let chunk_id = format!("{knowledge_document_id}_chunk_{chunk_index:04}");
            self.connection.execute(
                "INSERT INTO knowledge_document_chunks (
                    chunk_id, knowledge_document_id, workspace_id, chunk_index, text, created_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    chunk_id,
                    knowledge_document_id,
                    workspace_id,
                    chunk_index as i64,
                    text,
                    created_at,
                ],
            )?;
        }

        Ok(())
    }
}

fn chunk_knowledge_document_content(content: &str) -> Vec<String> {
    let normalized = content.replace("\r\n", "\n").replace('\r', "\n");
    let paragraphs = normalized
        .split("\n\n")
        .map(str::trim)
        .filter(|paragraph| !paragraph.is_empty())
        .collect::<Vec<_>>();

    if paragraphs.is_empty() {
        return Vec::new();
    }

    let mut chunks = Vec::new();
    let mut current = String::new();

    for paragraph in paragraphs {
        append_paragraph_to_chunks(paragraph, &mut current, &mut chunks);
    }

    if !current.trim().is_empty() {
        chunks.push(current.trim().to_owned());
    }

    chunks
}

fn append_paragraph_to_chunks(paragraph: &str, current: &mut String, chunks: &mut Vec<String>) {
    if paragraph.chars().count() > MAX_CHUNK_CHARS {
        if !current.trim().is_empty() {
            chunks.push(current.trim().to_owned());
            current.clear();
        }
        split_large_paragraph(paragraph, chunks);
        return;
    }

    let separator_chars = if current.is_empty() { 0 } else { 2 };
    let next_len = current.chars().count() + separator_chars + paragraph.chars().count();
    if next_len > TARGET_CHUNK_CHARS && current.chars().count() >= MIN_CHUNK_CHARS {
        chunks.push(current.trim().to_owned());
        current.clear();
    }

    if !current.is_empty() {
        current.push_str("\n\n");
    }
    current.push_str(paragraph);

    if current.chars().count() >= MAX_CHUNK_CHARS {
        chunks.push(current.trim().to_owned());
        current.clear();
    }
}

fn split_large_paragraph(paragraph: &str, chunks: &mut Vec<String>) {
    let mut current = String::new();

    for word in paragraph.split_whitespace() {
        let separator_chars = if current.is_empty() { 0 } else { 1 };
        let next_len = current.chars().count() + separator_chars + word.chars().count();
        if next_len > TARGET_CHUNK_CHARS && !current.is_empty() {
            chunks.push(current.trim().to_owned());
            current.clear();
        }
        if !current.is_empty() {
            current.push(' ');
        }
        current.push_str(word);
    }

    if !current.trim().is_empty() {
        chunks.push(current.trim().to_owned());
    }
}

fn lexical_terms(query: &str) -> Vec<String> {
    query
        .to_lowercase()
        .split(|character: char| !character.is_alphanumeric())
        .map(str::trim)
        .filter(|term| term.len() >= 2)
        .map(str::to_owned)
        .fold(Vec::new(), |mut terms, term| {
            if !terms.contains(&term) {
                terms.push(term);
            }
            terms
        })
}

fn knowledge_search_score(row: &KnowledgeDocumentSearchResultRow, terms: &[String]) -> i64 {
    let title = row.document_title.to_lowercase();
    let source = row.source_label.to_lowercase();
    let tags = row.tags.to_lowercase();
    let text = row.text.to_lowercase();

    terms
        .iter()
        .map(|term| {
            10 * count_matches(&title, term)
                + 6 * count_matches(&tags, term)
                + 4 * count_matches(&source, term)
                + 2 * count_matches(&text, term)
        })
        .sum()
}

fn count_matches(haystack: &str, needle: &str) -> i64 {
    haystack.matches(needle).count() as i64
}
