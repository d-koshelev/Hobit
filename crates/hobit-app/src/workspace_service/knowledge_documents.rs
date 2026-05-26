use hobit_storage_sqlite::{KnowledgeDocumentUpdate, NewKnowledgeDocument};

use crate::WorkspaceServiceError;

use super::{
    knowledge_document_search::{bounded_knowledge_snippet, normalized_knowledge_search_limit},
    mapping::{knowledge_document_search_result_summary, knowledge_document_summary},
    placeholder_id, placeholder_timestamp,
    validation::required_input,
    CreateKnowledgeDocumentInput, DeleteKnowledgeDocumentInput,
    KnowledgeDocumentSearchResultSummary, KnowledgeDocumentSummary, SearchKnowledgeDocumentsInput,
    UpdateKnowledgeDocumentInput, WorkspaceService,
};

impl WorkspaceService {
    pub fn create_knowledge_document(
        &self,
        input: CreateKnowledgeDocumentInput,
    ) -> Result<KnowledgeDocumentSummary, WorkspaceServiceError> {
        let input = normalize_create_knowledge_document_input(input)?;
        let knowledge_document_id = placeholder_id("kdoc_");
        let created_at = placeholder_timestamp();

        let document = self
            .store
            .with_immediate_transaction(|store| {
                if store.get_workspace(&input.workspace_id)?.is_none() {
                    return Err(hobit_storage_sqlite::StorageError::InvalidParameterName(
                        format!("workspace not found: {}", input.workspace_id),
                    ));
                }

                let document = store.create_knowledge_document(NewKnowledgeDocument {
                    knowledge_document_id: &knowledge_document_id,
                    workspace_id: &input.workspace_id,
                    scope: Some(&input.scope),
                    title: &input.title,
                    source_label: &input.source_label,
                    content: &input.content,
                    tags: &input.tags,
                    enabled: input.enabled,
                    created_at: Some(&created_at),
                    updated_at: Some(&created_at),
                })?;
                store.touch_workspace(&input.workspace_id)?;
                Ok(document)
            })
            .map_err(map_storage_knowledge_document_error)?;

        Ok(knowledge_document_summary(document))
    }

    pub fn list_knowledge_documents(
        &self,
        workspace_id: &str,
    ) -> Result<Vec<KnowledgeDocumentSummary>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;

        if self.store.get_workspace(workspace_id)?.is_none() {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "workspace not found: {workspace_id}"
            )));
        }

        Ok(self
            .store
            .list_knowledge_documents_for_workspace(workspace_id)?
            .into_iter()
            .map(knowledge_document_summary)
            .collect())
    }

    pub fn get_knowledge_document(
        &self,
        workspace_id: &str,
        knowledge_document_id: &str,
    ) -> Result<Option<KnowledgeDocumentSummary>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let knowledge_document_id = required_input(knowledge_document_id, "knowledge document id")?;

        self.validate_knowledge_document_workspace_access(workspace_id, knowledge_document_id)?;
        Ok(self
            .store
            .get_knowledge_document(workspace_id, knowledge_document_id)?
            .map(knowledge_document_summary))
    }

    pub fn update_knowledge_document(
        &self,
        input: UpdateKnowledgeDocumentInput,
    ) -> Result<Option<KnowledgeDocumentSummary>, WorkspaceServiceError> {
        let input = normalize_update_knowledge_document_input(input)?;
        self.validate_knowledge_document_workspace_access(
            &input.workspace_id,
            &input.knowledge_document_id,
        )?;

        let updated_at = placeholder_timestamp();
        let document = self.store.with_immediate_transaction(|store| {
            let document = store.update_knowledge_document(
                &input.workspace_id,
                &input.knowledge_document_id,
                KnowledgeDocumentUpdate {
                    title: &input.title,
                    scope: Some(&input.scope),
                    source_label: &input.source_label,
                    content: &input.content,
                    tags: &input.tags,
                    enabled: input.enabled,
                    updated_at: Some(&updated_at),
                },
            )?;
            if document.is_some() {
                store.touch_workspace(&input.workspace_id)?;
            }
            Ok(document)
        })?;

        Ok(document.map(knowledge_document_summary))
    }

    pub fn delete_knowledge_document(
        &self,
        input: DeleteKnowledgeDocumentInput,
    ) -> Result<bool, WorkspaceServiceError> {
        let input = normalize_delete_knowledge_document_input(input)?;
        self.validate_knowledge_document_workspace_access(
            &input.workspace_id,
            &input.knowledge_document_id,
        )?;

        self.store
            .with_immediate_transaction(|store| {
                let deleted = store
                    .delete_knowledge_document(&input.workspace_id, &input.knowledge_document_id)?;
                if deleted {
                    store.touch_workspace(&input.workspace_id)?;
                }
                Ok(deleted)
            })
            .map_err(WorkspaceServiceError::from)
    }

    pub fn search_knowledge_documents(
        &self,
        input: SearchKnowledgeDocumentsInput,
    ) -> Result<Vec<KnowledgeDocumentSearchResultSummary>, WorkspaceServiceError> {
        let workspace_id = required_owned(input.workspace_id, "workspace id")?;
        let query = input.query.trim().to_owned();
        if query.is_empty() {
            return Ok(Vec::new());
        }

        if self.store.get_workspace(&workspace_id)?.is_none() {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "workspace not found: {workspace_id}"
            )));
        }

        let limit = normalized_knowledge_search_limit(input.limit);

        Ok(self
            .store
            .search_knowledge_documents(&workspace_id, &query, limit)?
            .into_iter()
            .map(|row| {
                let snippet = bounded_knowledge_snippet(&row.text);
                knowledge_document_search_result_summary(row, snippet)
            })
            .collect())
    }

    fn validate_knowledge_document_workspace_access(
        &self,
        workspace_id: &str,
        knowledge_document_id: &str,
    ) -> Result<(), WorkspaceServiceError> {
        if self.store.get_workspace(workspace_id)?.is_none() {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "workspace not found: {workspace_id}"
            )));
        }

        let Some(document) = self
            .store
            .get_knowledge_document_by_id(knowledge_document_id)?
        else {
            return Ok(());
        };

        if document.scope != "global" && document.workspace_id != workspace_id {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "knowledge document does not belong to workspace: {knowledge_document_id}"
            )));
        }

        Ok(())
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedCreateKnowledgeDocumentInput {
    workspace_id: String,
    title: String,
    source_label: String,
    content: String,
    tags: String,
    enabled: bool,
    scope: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedUpdateKnowledgeDocumentInput {
    workspace_id: String,
    knowledge_document_id: String,
    title: String,
    source_label: String,
    content: String,
    tags: String,
    enabled: bool,
    scope: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedDeleteKnowledgeDocumentInput {
    workspace_id: String,
    knowledge_document_id: String,
}

fn normalize_create_knowledge_document_input(
    input: CreateKnowledgeDocumentInput,
) -> Result<NormalizedCreateKnowledgeDocumentInput, WorkspaceServiceError> {
    Ok(NormalizedCreateKnowledgeDocumentInput {
        workspace_id: required_owned(input.workspace_id, "workspace id")?,
        title: required_owned(input.title, "knowledge document title")?,
        source_label: normalize_source_label(input.source_label),
        content: input.content,
        tags: normalize_tags(input.tags),
        enabled: input.enabled,
        scope: normalize_scope(input.scope),
    })
}

fn normalize_update_knowledge_document_input(
    input: UpdateKnowledgeDocumentInput,
) -> Result<NormalizedUpdateKnowledgeDocumentInput, WorkspaceServiceError> {
    Ok(NormalizedUpdateKnowledgeDocumentInput {
        workspace_id: required_owned(input.workspace_id, "workspace id")?,
        knowledge_document_id: required_owned(
            input.knowledge_document_id,
            "knowledge document id",
        )?,
        title: required_owned(input.title, "knowledge document title")?,
        source_label: normalize_source_label(input.source_label),
        content: input.content,
        tags: normalize_tags(input.tags),
        enabled: input.enabled,
        scope: normalize_scope(input.scope),
    })
}

fn normalize_delete_knowledge_document_input(
    input: DeleteKnowledgeDocumentInput,
) -> Result<NormalizedDeleteKnowledgeDocumentInput, WorkspaceServiceError> {
    Ok(NormalizedDeleteKnowledgeDocumentInput {
        workspace_id: required_owned(input.workspace_id, "workspace id")?,
        knowledge_document_id: required_owned(
            input.knowledge_document_id,
            "knowledge document id",
        )?,
    })
}

fn normalize_source_label(source_label: String) -> String {
    let trimmed = source_label.trim();
    if trimmed.is_empty() {
        "Workspace document".to_owned()
    } else {
        trimmed.to_owned()
    }
}

fn normalize_tags(tags: String) -> String {
    tags.split(',')
        .map(str::trim)
        .filter(|tag| !tag.is_empty())
        .collect::<Vec<_>>()
        .join(", ")
}

fn normalize_scope(scope: Option<String>) -> String {
    match scope.as_deref().map(str::trim) {
        Some("global") => "global".to_owned(),
        _ => "workspace".to_owned(),
    }
}

fn required_owned(value: String, label: &str) -> Result<String, WorkspaceServiceError> {
    required_input(&value, label).map(str::to_owned)
}

fn map_storage_knowledge_document_error(
    error: hobit_storage_sqlite::StorageError,
) -> WorkspaceServiceError {
    match error {
        hobit_storage_sqlite::StorageError::InvalidParameterName(message) => {
            WorkspaceServiceError::InvalidInput(message)
        }
        error => WorkspaceServiceError::from(error),
    }
}
