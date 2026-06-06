use hobit_storage_sqlite::{KnowledgeDocumentUpdate, NewKnowledgeDocument};

use crate::{
    KnowledgeLifecycleStatus, KnowledgeRelation, KnowledgeSourceRef, WorkspaceServiceError,
};

use super::{
    knowledge_document_search::{bounded_knowledge_snippet, normalized_knowledge_search_limit},
    mapping::{knowledge_document_search_result_summary, knowledge_document_summary},
    placeholder_id, placeholder_timestamp,
    validation::required_input,
    CreateKnowledgeDocumentInput, DeleteKnowledgeDocumentInput,
    KnowledgeDocumentSearchResultSummary, KnowledgeDocumentSummary, SearchKnowledgeDocumentsInput,
    UpdateKnowledgeDocumentInput, WorkspaceService,
};

const CATALOG_ITEM_TYPE_CODEBASE_KNOWLEDGE: &str = "codebase_knowledge";
const CATALOG_ITEM_TYPE_DOCUMENT: &str = "document";
const CATALOG_ITEM_TYPE_DOCUMENTATION_KNOWLEDGE: &str = "documentation_knowledge";
const CATALOG_ITEM_TYPE_ARCHITECTURE_DECISION: &str = "architecture_decision";
const CATALOG_ITEM_TYPE_DECISION: &str = "decision";
const CATALOG_ITEM_TYPE_RUNBOOK: &str = "runbook";
const CATALOG_ITEM_TYPE_SKILL: &str = "skill";
const CATALOG_ITEM_TYPE_PROMPT_TEMPLATE: &str = "prompt_template";
const CATALOG_ITEM_TYPE_VALIDATION_RULE: &str = "validation_rule";
const CATALOG_ITEM_TYPE_KNOWN_ISSUE: &str = "known_issue";
const CATALOG_ITEM_TYPE_WORKFLOW: &str = "workflow";
const CATALOG_ITEM_TYPE_COMMAND_HISTORY_SUMMARY: &str = "command_history_summary";
const CATALOG_ITEM_TYPE_INVESTIGATION_SUMMARY: &str = "investigation_summary";
const CATALOG_ITEM_TYPE_EXTERNAL_REFERENCE: &str = "external_reference";

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
                    catalog_item_type: Some(&input.catalog_item_type),
                    quick_summary: Some(&input.quick_summary),
                    lifecycle_status: Some(&input.lifecycle_status),
                    title: &input.title,
                    source_label: &input.source_label,
                    source_kind: Some(&input.source_kind),
                    source_ref: Some(&input.source_ref),
                    source_refs: Some(&input.source_refs_json),
                    relations: Some(&input.relations_json),
                    content: &input.content,
                    tags: &input.tags,
                    enabled: input.enabled,
                    searchable: input.searchable,
                    version_summary: input.version_summary.as_deref(),
                    created_at: Some(&created_at),
                    updated_at: Some(&created_at),
                    reviewed_at: input.reviewed_at.as_deref(),
                    created_by_task_id: input.created_by_task_id.as_deref(),
                    created_from_run_id: input.created_from_run_id.as_deref(),
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
                    catalog_item_type: Some(&input.catalog_item_type),
                    quick_summary: Some(&input.quick_summary),
                    lifecycle_status: Some(&input.lifecycle_status),
                    source_label: &input.source_label,
                    source_kind: Some(&input.source_kind),
                    source_ref: Some(&input.source_ref),
                    source_refs: Some(&input.source_refs_json),
                    relations: Some(&input.relations_json),
                    content: &input.content,
                    tags: &input.tags,
                    enabled: input.enabled,
                    searchable: input.searchable,
                    version_summary: input.version_summary.as_deref(),
                    updated_at: Some(&updated_at),
                    reviewed_at: input.reviewed_at.as_deref(),
                    created_by_task_id: input.created_by_task_id.as_deref(),
                    created_from_run_id: input.created_from_run_id.as_deref(),
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
    catalog_item_type: String,
    quick_summary: String,
    lifecycle_status: String,
    source_label: String,
    source_kind: String,
    source_ref: String,
    source_refs_json: String,
    relations_json: String,
    content: String,
    tags: String,
    enabled: bool,
    searchable: bool,
    version_summary: Option<String>,
    reviewed_at: Option<String>,
    created_by_task_id: Option<String>,
    created_from_run_id: Option<String>,
    scope: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedUpdateKnowledgeDocumentInput {
    workspace_id: String,
    knowledge_document_id: String,
    title: String,
    catalog_item_type: String,
    quick_summary: String,
    lifecycle_status: String,
    source_label: String,
    source_kind: String,
    source_ref: String,
    source_refs_json: String,
    relations_json: String,
    content: String,
    tags: String,
    enabled: bool,
    searchable: bool,
    version_summary: Option<String>,
    reviewed_at: Option<String>,
    created_by_task_id: Option<String>,
    created_from_run_id: Option<String>,
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
    let source_label = normalize_source_label(input.source_label);
    let has_typed_source_refs = !input.source_refs.is_empty();
    let source_refs = normalize_source_refs(
        input.source_refs,
        &input.source_kind,
        &input.source_ref,
        &source_label,
    );
    let source_kind = normalize_source_kind(input.source_kind.or_else(|| {
        has_typed_source_refs
            .then(|| {
                source_refs
                    .first()
                    .map(|source_ref| source_ref.legacy_kind().to_owned())
            })
            .flatten()
    }));
    let source_ref = normalize_source_ref(input.source_ref.or_else(|| {
        has_typed_source_refs
            .then(|| {
                source_refs
                    .first()
                    .map(|source_ref| source_ref.legacy_ref().to_owned())
            })
            .flatten()
    }));
    let (created_by_task_id, created_from_run_id) = normalize_source_provenance(
        input.created_by_task_id,
        input.created_from_run_id,
        &source_refs,
    );

    Ok(NormalizedCreateKnowledgeDocumentInput {
        workspace_id: required_owned(input.workspace_id, "workspace id")?,
        title: required_owned(input.title, "knowledge document title")?,
        catalog_item_type: normalize_catalog_item_type(input.catalog_item_type)?,
        quick_summary: normalize_quick_summary(input.quick_summary),
        lifecycle_status: normalize_lifecycle_status(input.lifecycle_status)?,
        source_label,
        source_kind,
        source_ref,
        source_refs_json: serialize_source_refs(&source_refs)?,
        relations_json: serialize_relations(&input.relations)?,
        content: input.content,
        tags: normalize_tags(input.tags),
        enabled: input.enabled,
        searchable: input.searchable,
        version_summary: normalize_optional_line(input.version_summary),
        reviewed_at: normalize_optional_line(input.reviewed_at),
        created_by_task_id,
        created_from_run_id,
        scope: normalize_scope(input.scope),
    })
}

fn normalize_update_knowledge_document_input(
    input: UpdateKnowledgeDocumentInput,
) -> Result<NormalizedUpdateKnowledgeDocumentInput, WorkspaceServiceError> {
    let source_label = normalize_source_label(input.source_label);
    let has_typed_source_refs = !input.source_refs.is_empty();
    let source_refs = normalize_source_refs(
        input.source_refs,
        &input.source_kind,
        &input.source_ref,
        &source_label,
    );
    let source_kind = normalize_source_kind(input.source_kind.or_else(|| {
        has_typed_source_refs
            .then(|| {
                source_refs
                    .first()
                    .map(|source_ref| source_ref.legacy_kind().to_owned())
            })
            .flatten()
    }));
    let source_ref = normalize_source_ref(input.source_ref.or_else(|| {
        has_typed_source_refs
            .then(|| {
                source_refs
                    .first()
                    .map(|source_ref| source_ref.legacy_ref().to_owned())
            })
            .flatten()
    }));
    let (created_by_task_id, created_from_run_id) = normalize_source_provenance(
        input.created_by_task_id,
        input.created_from_run_id,
        &source_refs,
    );

    Ok(NormalizedUpdateKnowledgeDocumentInput {
        workspace_id: required_owned(input.workspace_id, "workspace id")?,
        knowledge_document_id: required_owned(
            input.knowledge_document_id,
            "knowledge document id",
        )?,
        title: required_owned(input.title, "knowledge document title")?,
        catalog_item_type: normalize_catalog_item_type(input.catalog_item_type)?,
        quick_summary: normalize_quick_summary(input.quick_summary),
        lifecycle_status: normalize_lifecycle_status(input.lifecycle_status)?,
        source_label,
        source_kind,
        source_ref,
        source_refs_json: serialize_source_refs(&source_refs)?,
        relations_json: serialize_relations(&input.relations)?,
        content: input.content,
        tags: normalize_tags(input.tags),
        enabled: input.enabled,
        searchable: input.searchable,
        version_summary: normalize_optional_line(input.version_summary),
        reviewed_at: normalize_optional_line(input.reviewed_at),
        created_by_task_id,
        created_from_run_id,
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

fn normalize_source_kind(source_kind: Option<String>) -> String {
    source_kind
        .as_deref()
        .map(str::trim)
        .filter(|source_kind| !source_kind.is_empty())
        .unwrap_or("operator_authored")
        .to_owned()
}

fn normalize_source_ref(source_ref: Option<String>) -> String {
    source_ref
        .as_deref()
        .map(str::trim)
        .unwrap_or("")
        .to_owned()
}

fn normalize_quick_summary(quick_summary: Option<String>) -> String {
    quick_summary
        .as_deref()
        .unwrap_or("")
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .take(3)
        .collect::<Vec<_>>()
        .join("\n")
}

fn normalize_catalog_item_type(
    catalog_item_type: Option<String>,
) -> Result<String, WorkspaceServiceError> {
    let catalog_item_type = catalog_item_type
        .as_deref()
        .map(str::trim)
        .filter(|catalog_item_type| !catalog_item_type.is_empty())
        .unwrap_or(CATALOG_ITEM_TYPE_DOCUMENTATION_KNOWLEDGE)
        .to_owned();

    match catalog_item_type.as_str() {
        CATALOG_ITEM_TYPE_DOCUMENT
        | CATALOG_ITEM_TYPE_CODEBASE_KNOWLEDGE
        | CATALOG_ITEM_TYPE_DOCUMENTATION_KNOWLEDGE
        | CATALOG_ITEM_TYPE_ARCHITECTURE_DECISION
        | CATALOG_ITEM_TYPE_DECISION
        | CATALOG_ITEM_TYPE_RUNBOOK
        | CATALOG_ITEM_TYPE_SKILL
        | CATALOG_ITEM_TYPE_PROMPT_TEMPLATE
        | CATALOG_ITEM_TYPE_VALIDATION_RULE
        | CATALOG_ITEM_TYPE_KNOWN_ISSUE
        | CATALOG_ITEM_TYPE_WORKFLOW
        | CATALOG_ITEM_TYPE_COMMAND_HISTORY_SUMMARY
        | CATALOG_ITEM_TYPE_INVESTIGATION_SUMMARY
        | CATALOG_ITEM_TYPE_EXTERNAL_REFERENCE => Ok(catalog_item_type),
        _ => Err(WorkspaceServiceError::InvalidInput(format!(
            "unsupported knowledge catalog item type: {catalog_item_type}"
        ))),
    }
}

fn normalize_lifecycle_status(
    lifecycle_status: Option<String>,
) -> Result<String, WorkspaceServiceError> {
    let lifecycle_status = lifecycle_status
        .as_deref()
        .map(str::trim)
        .filter(|lifecycle_status| !lifecycle_status.is_empty())
        .unwrap_or(KnowledgeLifecycleStatus::Active.as_str())
        .to_owned();

    KnowledgeLifecycleStatus::try_from(lifecycle_status.as_str())
        .map(|status| status.as_str().to_owned())
        .map_err(|_| {
            WorkspaceServiceError::InvalidInput(format!(
                "unsupported knowledge lifecycle status: {lifecycle_status}"
            ))
        })
}

fn normalize_tags(tags: String) -> String {
    tags.split(',')
        .map(str::trim)
        .filter(|tag| !tag.is_empty())
        .collect::<Vec<_>>()
        .join(", ")
}

fn normalize_source_refs(
    source_refs: Vec<KnowledgeSourceRef>,
    source_kind: &Option<String>,
    source_ref: &Option<String>,
    source_label: &str,
) -> Vec<KnowledgeSourceRef> {
    if source_refs.is_empty() {
        vec![KnowledgeSourceRef::from_legacy_fields(
            source_kind.as_deref().unwrap_or("operator_authored"),
            source_ref.as_deref().unwrap_or(""),
            source_label.to_owned(),
        )]
    } else {
        source_refs
    }
}

fn serialize_source_refs(
    source_refs: &[KnowledgeSourceRef],
) -> Result<String, WorkspaceServiceError> {
    serde_json::to_string(source_refs).map_err(|error| {
        WorkspaceServiceError::InvalidInput(format!("invalid knowledge source refs: {error}"))
    })
}

fn serialize_relations(relations: &[KnowledgeRelation]) -> Result<String, WorkspaceServiceError> {
    serde_json::to_string(relations).map_err(|error| {
        WorkspaceServiceError::InvalidInput(format!("invalid knowledge relations: {error}"))
    })
}

fn normalize_source_provenance(
    created_by_task_id: Option<String>,
    created_from_run_id: Option<String>,
    source_refs: &[KnowledgeSourceRef],
) -> (Option<String>, Option<String>) {
    let inferred_task_id = source_refs.iter().find_map(|source_ref| match source_ref {
        KnowledgeSourceRef::QueueTask(source) => Some(source.queue_task_id.clone()),
        KnowledgeSourceRef::QueueRun(source) => source.queue_task_id.clone(),
        _ => None,
    });
    let inferred_run_id = source_refs.iter().find_map(|source_ref| match source_ref {
        KnowledgeSourceRef::QueueRun(source) => Some(source.run_id.clone()),
        _ => None,
    });

    (
        normalize_optional_line(created_by_task_id).or(inferred_task_id),
        normalize_optional_line(created_from_run_id).or(inferred_run_id),
    )
}

fn normalize_optional_line(value: Option<String>) -> Option<String> {
    value
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
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
