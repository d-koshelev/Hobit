use hobit_storage_sqlite::{AgentQueueTaskRow, KnowledgeDocumentRow, SkillRow};
use serde::{Deserialize, Serialize};

use crate::WorkspaceServiceError;

mod prompt;

use prompt::{capped_snapshots_for_prompt, prompt_context_section, prompt_evidence_section};

use super::{
    agent_queue_tasks::{load_agent_queue_task, map_storage_agent_queue_task_error},
    mapping::agent_queue_task_summary,
    placeholder_timestamp,
    validation::required_input,
    AgentQueueTaskSummary, AttachKnowledgeToQueueTaskInput, AttachSkillToQueueTaskInput,
    DetachKnowledgeFromQueueTaskInput, DetachSkillFromQueueTaskInput, WorkspaceService,
};

const CONTEXT_TOKEN_BUDGET: i64 = 1600;
const CONTEXT_CHAR_BUDGET: usize = (CONTEXT_TOKEN_BUDGET as usize) * 4;
const KNOWLEDGE_DOCUMENT_EXCERPT_CHARS: usize = 2200;
const SKILL_INSTRUCTION_CHARS: usize = 1800;
const MAX_AGENT_QUEUE_TASK_CONTEXT_JSON_BYTES: usize = 64 * 1024;

impl WorkspaceService {
    pub fn attach_knowledge_to_queue_task(
        &self,
        input: AttachKnowledgeToQueueTaskInput,
    ) -> Result<AgentQueueTaskSummary, WorkspaceServiceError> {
        let input = normalize_attach_knowledge_input(input)?;
        let updated_at = placeholder_timestamp();

        self.store
            .with_immediate_transaction(|store| {
                let task = load_agent_queue_task(store, &input.workspace_id, &input.queue_item_id)?;
                let document = store
                    .get_knowledge_document(&input.workspace_id, &input.knowledge_id)?
                    .ok_or_else(|| {
                        hobit_storage_sqlite::StorageError::InvalidParameterName(format!(
                            "knowledge document not found or not allowed for workspace: {}",
                            input.knowledge_id
                        ))
                    })?;
                let mut context = parse_task_context(task.context_json.as_deref())
                    .map_err(storage_invalid_context)?;
                attach_document_context(&mut context, &document, &updated_at)
                    .map_err(storage_invalid_context)?;
                let context_json =
                    serialize_task_context(&context).map_err(storage_invalid_context)?;
                let task = store
                    .update_agent_queue_task_context(
                        &input.workspace_id,
                        &input.queue_item_id,
                        Some(&context_json),
                        Some(&updated_at),
                    )?
                    .ok_or(hobit_storage_sqlite::StorageError::QueryReturnedNoRows)?;
                store.touch_workspace(&input.workspace_id)?;
                Ok(task)
            })
            .map(agent_queue_task_summary)
            .map_err(map_storage_agent_queue_task_error)
    }

    pub fn detach_knowledge_from_queue_task(
        &self,
        input: DetachKnowledgeFromQueueTaskInput,
    ) -> Result<AgentQueueTaskSummary, WorkspaceServiceError> {
        let input = normalize_detach_knowledge_input(input)?;
        self.detach_queue_task_context_ref(
            &input.workspace_id,
            &input.queue_item_id,
            &input.knowledge_id,
        )
    }

    pub fn attach_skill_to_queue_task(
        &self,
        input: AttachSkillToQueueTaskInput,
    ) -> Result<AgentQueueTaskSummary, WorkspaceServiceError> {
        let input = normalize_attach_skill_input(input)?;
        let updated_at = placeholder_timestamp();

        self.store
            .with_immediate_transaction(|store| {
                let task = load_agent_queue_task(store, &input.workspace_id, &input.queue_item_id)?;
                let skill = store
                    .get_skill(&input.workspace_id, &input.skill_id)?
                    .ok_or_else(|| {
                        hobit_storage_sqlite::StorageError::InvalidParameterName(format!(
                            "skill not found or not allowed for workspace: {}",
                            input.skill_id
                        ))
                    })?;
                let mut context = parse_task_context(task.context_json.as_deref())
                    .map_err(storage_invalid_context)?;
                attach_skill_context(&mut context, &skill, &updated_at)
                    .map_err(storage_invalid_context)?;
                let context_json =
                    serialize_task_context(&context).map_err(storage_invalid_context)?;
                let task = store
                    .update_agent_queue_task_context(
                        &input.workspace_id,
                        &input.queue_item_id,
                        Some(&context_json),
                        Some(&updated_at),
                    )?
                    .ok_or(hobit_storage_sqlite::StorageError::QueryReturnedNoRows)?;
                store.touch_workspace(&input.workspace_id)?;
                Ok(task)
            })
            .map(agent_queue_task_summary)
            .map_err(map_storage_agent_queue_task_error)
    }

    pub fn detach_skill_from_queue_task(
        &self,
        input: DetachSkillFromQueueTaskInput,
    ) -> Result<AgentQueueTaskSummary, WorkspaceServiceError> {
        let input = normalize_detach_skill_input(input)?;
        self.detach_queue_task_context_ref(
            &input.workspace_id,
            &input.queue_item_id,
            &input.skill_id,
        )
    }

    fn detach_queue_task_context_ref(
        &self,
        workspace_id: &str,
        queue_item_id: &str,
        source_ref_id: &str,
    ) -> Result<AgentQueueTaskSummary, WorkspaceServiceError> {
        let updated_at = placeholder_timestamp();
        self.store
            .with_immediate_transaction(|store| {
                let task = load_agent_queue_task(store, workspace_id, queue_item_id)?;
                let mut context = parse_task_context(task.context_json.as_deref())
                    .map_err(storage_invalid_context)?;
                detach_context_ref(&mut context, source_ref_id);
                let context_json =
                    serialize_task_context(&context).map_err(storage_invalid_context)?;
                let task = store
                    .update_agent_queue_task_context(
                        workspace_id,
                        queue_item_id,
                        Some(&context_json),
                        Some(&updated_at),
                    )?
                    .ok_or(hobit_storage_sqlite::StorageError::QueryReturnedNoRows)?;
                store.touch_workspace(workspace_id)?;
                Ok(task)
            })
            .map(agent_queue_task_summary)
            .map_err(map_storage_agent_queue_task_error)
    }

    pub fn materialize_agent_queue_task_context_prompt(
        &self,
        workspace_id: &str,
        queue_item_id: &str,
    ) -> Result<Option<String>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let queue_item_id = required_input(queue_item_id, "queue item id")?;
        let task = load_agent_queue_task(&self.store, workspace_id, queue_item_id)
            .map_err(map_storage_agent_queue_task_error)?;
        materialize_queue_task_context_prompt(&task).map_err(WorkspaceServiceError::InvalidInput)
    }
}

pub(super) fn materialize_queue_task_context_prompt(
    task: &AgentQueueTaskRow,
) -> Result<Option<String>, String> {
    let context = parse_task_context(task.context_json.as_deref())?;
    if context.attached_knowledge_snapshots.is_empty() {
        return Ok(None);
    }

    let blocked_warnings = context
        .context_warnings
        .iter()
        .filter(|warning| warning.severity == "blocked")
        .map(|warning| warning.id.as_str())
        .collect::<Vec<_>>();
    if !blocked_warnings.is_empty() {
        return Err(format!(
            "queue task context has blocked warnings: {}",
            blocked_warnings.join(", ")
        ));
    }

    let snapshots = capped_snapshots_for_prompt(&context.attached_knowledge_snapshots);
    if snapshots.is_empty() {
        return Ok(None);
    }

    let context_section = prompt_context_section(&snapshots);
    let evidence_section = prompt_evidence_section(task, &snapshots, &context.context_warnings);
    Ok(Some(
        [
            context_section,
            task.prompt.trim().to_owned(),
            evidence_section,
        ]
        .into_iter()
        .filter(|section| !section.trim().is_empty())
        .collect::<Vec<_>>()
        .join("\n\n"),
    ))
}

#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct QueueTaskContext {
    attached_knowledge_refs: Vec<QueueTaskContextRef>,
    attached_skill_refs: Vec<QueueTaskContextRef>,
    attached_knowledge_snapshots: Vec<QueueTaskContextSnapshot>,
    context_warnings: Vec<QueueTaskContextWarning>,
    context_token_budget: QueueTaskContextTokenBudget,
    materialized_at: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct QueueTaskContextRef {
    attached_at: String,
    id: String,
    kind: String,
    quick_summary: String,
    scope: String,
    source: String,
    status: String,
    title: String,
    version: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct QueueTaskContextSnapshot {
    capped: bool,
    content: String,
    id: String,
    kind: String,
    materialized_at: String,
    scope: String,
    source: String,
    source_ref_id: String,
    status: String,
    title: String,
    token_estimate: i64,
    version: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct QueueTaskContextWarning {
    id: String,
    source_ref_id: String,
    severity: String,
    code: String,
    message: String,
    created_at: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct QueueTaskContextTokenBudget {
    estimated_tokens: i64,
    max_tokens: i64,
    over_budget: bool,
}

impl Default for QueueTaskContextTokenBudget {
    fn default() -> Self {
        Self {
            estimated_tokens: 0,
            max_tokens: CONTEXT_TOKEN_BUDGET,
            over_budget: false,
        }
    }
}

fn attach_document_context(
    context: &mut QueueTaskContext,
    document: &KnowledgeDocumentRow,
    attached_at: &str,
) -> Result<(), String> {
    if !document.enabled {
        return Err("disabled Knowledge cannot attach to Queue tasks".to_owned());
    }
    if !document.searchable {
        return Err("non-searchable Knowledge cannot attach to Queue tasks".to_owned());
    }
    if document.lifecycle_status == "rejected" {
        return Err("rejected Knowledge cannot attach to Queue tasks".to_owned());
    }

    let ref_item = QueueTaskContextRef {
        attached_at: attached_at.to_owned(),
        id: document.knowledge_document_id.clone(),
        kind: "knowledge_document".to_owned(),
        quick_summary: visible_value(&document.quick_summary, "Summary missing."),
        scope: if document.scope == "global" {
            "global".to_owned()
        } else {
            "workspace-local".to_owned()
        },
        source: visible_value(&document.source_label, "Knowledge Document"),
        status: document.lifecycle_status.clone(),
        title: visible_value(&document.title, "Untitled document"),
        version: document.updated_at.clone(),
    };
    let snapshot = knowledge_document_snapshot(document, &ref_item, attached_at);
    let warnings = knowledge_document_warnings(document, &ref_item, attached_at);
    merge_context(context, ref_item, snapshot, warnings)
}

fn attach_skill_context(
    context: &mut QueueTaskContext,
    skill: &SkillRow,
    attached_at: &str,
) -> Result<(), String> {
    if skill.review_status == "deprecated" {
        return Err("deprecated Skill cannot attach to Queue tasks".to_owned());
    }

    let ref_item = QueueTaskContextRef {
        attached_at: attached_at.to_owned(),
        id: skill.skill_id.clone(),
        kind: "skill".to_owned(),
        quick_summary: visible_value(&skill.when_to_use, "Summary missing."),
        scope: "workspace-local".to_owned(),
        source: "Workspace Skill".to_owned(),
        status: skill.review_status.clone(),
        title: visible_value(&skill.title, "Untitled skill"),
        version: skill.updated_at.clone(),
    };
    let snapshot = skill_snapshot(skill, &ref_item, attached_at);
    let warnings = skill_warnings(skill, &ref_item, attached_at);
    merge_context(context, ref_item, snapshot, warnings)
}

fn merge_context(
    context: &mut QueueTaskContext,
    ref_item: QueueTaskContextRef,
    snapshot: QueueTaskContextSnapshot,
    warnings: Vec<QueueTaskContextWarning>,
) -> Result<(), String> {
    detach_context_ref(context, &ref_item.id);
    if ref_item.kind == "skill" {
        context.attached_skill_refs.push(ref_item);
    } else {
        context.attached_knowledge_refs.push(ref_item);
    }
    context.attached_knowledge_snapshots.push(snapshot);
    context.context_warnings.extend(warnings);
    context.materialized_at = context
        .attached_knowledge_snapshots
        .last()
        .map(|snapshot| snapshot.materialized_at.clone());
    refresh_context_budget(context);
    Ok(())
}

fn detach_context_ref(context: &mut QueueTaskContext, source_ref_id: &str) {
    context
        .attached_knowledge_refs
        .retain(|ref_item| ref_item.id != source_ref_id);
    context
        .attached_skill_refs
        .retain(|ref_item| ref_item.id != source_ref_id);
    context
        .attached_knowledge_snapshots
        .retain(|snapshot| snapshot.source_ref_id != source_ref_id);
    context
        .context_warnings
        .retain(|warning| warning.source_ref_id != source_ref_id);
    context.materialized_at = context
        .attached_knowledge_snapshots
        .last()
        .map(|snapshot| snapshot.materialized_at.clone());
    refresh_context_budget(context);
}

fn knowledge_document_snapshot(
    document: &KnowledgeDocumentRow,
    ref_item: &QueueTaskContextRef,
    materialized_at: &str,
) -> QueueTaskContextSnapshot {
    let excerpt = bounded_text(&document.content, KNOWLEDGE_DOCUMENT_EXCERPT_CHARS);
    let content = [
        Some(format!("Knowledge Document: {}", ref_item.title)),
        Some(format!("Scope: {}", ref_item.scope)),
        Some(format!("Source: {}", ref_item.source)),
        Some(format!(
            "Version: {}",
            visible_value(&ref_item.version, "Unknown")
        )),
        Some(format!("Status: {}", ref_item.status)),
        Some(format!("Summary: {}", ref_item.quick_summary)),
        (!excerpt.text.is_empty()).then(|| format!("Bounded excerpt:\n{}", excerpt.text)),
    ]
    .into_iter()
    .flatten()
    .collect::<Vec<_>>()
    .join("\n");
    snapshot(
        "knowledge_document",
        ref_item,
        content,
        excerpt.capped,
        materialized_at,
    )
}

fn skill_snapshot(
    skill: &SkillRow,
    ref_item: &QueueTaskContextRef,
    materialized_at: &str,
) -> QueueTaskContextSnapshot {
    let body = [
        Some(format!("Skill Instructions: {}", ref_item.title)),
        Some(format!("Scope: {}", ref_item.scope)),
        Some(format!("Source: {}", ref_item.source)),
        Some(format!(
            "Version: {}",
            visible_value(&ref_item.version, "Unknown")
        )),
        Some(format!("Review status: {}", ref_item.status)),
        Some(format!(
            "When to use: {}",
            visible_value(&skill.when_to_use, "Summary missing.")
        )),
        (!skill.prerequisites.trim().is_empty())
            .then(|| format!("Prerequisites:\n{}", skill.prerequisites.trim())),
        (!skill.steps.trim().is_empty()).then(|| format!("Steps:\n{}", skill.steps.trim())),
        (!skill.validation.trim().is_empty())
            .then(|| format!("Validation:\n{}", skill.validation.trim())),
        (!skill.risks.trim().is_empty()).then(|| format!("Risks:\n{}", skill.risks.trim())),
        (!skill.tags.trim().is_empty()).then(|| format!("Tags: {}", skill.tags.trim())),
    ]
    .into_iter()
    .flatten()
    .collect::<Vec<_>>()
    .join("\n");
    let bounded = bounded_text(&body, SKILL_INSTRUCTION_CHARS);
    snapshot(
        "skill",
        ref_item,
        bounded.text,
        bounded.capped,
        materialized_at,
    )
}

fn snapshot(
    kind: &str,
    ref_item: &QueueTaskContextRef,
    content: String,
    capped: bool,
    materialized_at: &str,
) -> QueueTaskContextSnapshot {
    QueueTaskContextSnapshot {
        capped,
        content: content.clone(),
        id: format!("snapshot:{kind}:{}:{materialized_at}", ref_item.id),
        kind: kind.to_owned(),
        materialized_at: materialized_at.to_owned(),
        scope: ref_item.scope.clone(),
        source: ref_item.source.clone(),
        source_ref_id: ref_item.id.clone(),
        status: ref_item.status.clone(),
        title: ref_item.title.clone(),
        token_estimate: estimate_tokens(&content),
        version: ref_item.version.clone(),
    }
}

fn knowledge_document_warnings(
    document: &KnowledgeDocumentRow,
    ref_item: &QueueTaskContextRef,
    created_at: &str,
) -> Vec<QueueTaskContextWarning> {
    let mut warnings = Vec::new();
    if document.quick_summary.trim().is_empty() {
        warnings.push(context_warning(
            ref_item,
            "warning",
            "summary_missing",
            created_at,
        ));
    }
    if matches!(
        document.lifecycle_status.as_str(),
        "stale" | "draft" | "archived"
    ) {
        warnings.push(context_warning(
            ref_item,
            "warning",
            &document.lifecycle_status,
            created_at,
        ));
    }
    warnings
}

fn skill_warnings(
    skill: &SkillRow,
    ref_item: &QueueTaskContextRef,
    created_at: &str,
) -> Vec<QueueTaskContextWarning> {
    if skill.review_status == "reviewed" {
        Vec::new()
    } else {
        vec![context_warning(
            ref_item,
            "warning",
            &skill.review_status,
            created_at,
        )]
    }
}

fn context_warning(
    ref_item: &QueueTaskContextRef,
    severity: &str,
    code: &str,
    created_at: &str,
) -> QueueTaskContextWarning {
    QueueTaskContextWarning {
        id: format!("{}:{}:{code}", ref_item.kind, ref_item.id),
        source_ref_id: ref_item.id.clone(),
        severity: severity.to_owned(),
        code: code.to_owned(),
        message: context_warning_message(ref_item, code),
        created_at: created_at.to_owned(),
    }
}

fn context_warning_message(ref_item: &QueueTaskContextRef, code: &str) -> String {
    match code {
        "stale" => format!("{} is stale. Review before materialization.", ref_item.title),
        "draft" => format!(
            "{} is draft context. It is not reviewed project knowledge.",
            ref_item.title
        ),
        "needs_review" => format!(
            "{} needs review before it is treated as reliable guidance.",
            ref_item.title
        ),
        "archived" => format!("{} is archived. Review before materialization.", ref_item.title),
        "summary_missing" => format!(
            "{} has a summary missing warning. Add a quick summary before relying on this Knowledge context.",
            ref_item.title
        ),
        _ => format!("{} has a context warning: {code}.", ref_item.title),
    }
}

fn refresh_context_budget(context: &mut QueueTaskContext) {
    let estimated_tokens = context
        .attached_knowledge_snapshots
        .iter()
        .map(|snapshot| snapshot.token_estimate)
        .sum::<i64>();
    context.context_token_budget = QueueTaskContextTokenBudget {
        estimated_tokens,
        max_tokens: CONTEXT_TOKEN_BUDGET,
        over_budget: estimated_tokens > CONTEXT_TOKEN_BUDGET,
    };
}

fn parse_task_context(raw: Option<&str>) -> Result<QueueTaskContext, String> {
    let Some(raw) = raw.map(str::trim).filter(|raw| !raw.is_empty()) else {
        return Ok(QueueTaskContext::default());
    };
    serde_json::from_str::<QueueTaskContext>(raw)
        .map_err(|error| format!("queue task context json is invalid: {error}"))
}

fn serialize_task_context(context: &QueueTaskContext) -> Result<String, String> {
    let context_json = serde_json::to_string(context)
        .map_err(|error| format!("queue task context json is invalid: {error}"))?;
    if context_json.len() > MAX_AGENT_QUEUE_TASK_CONTEXT_JSON_BYTES {
        return Err(format!(
            "queue task context json must be at most {MAX_AGENT_QUEUE_TASK_CONTEXT_JSON_BYTES} bytes"
        ));
    }
    Ok(context_json)
}

fn normalize_attach_knowledge_input(
    input: AttachKnowledgeToQueueTaskInput,
) -> Result<AttachKnowledgeToQueueTaskInput, WorkspaceServiceError> {
    Ok(AttachKnowledgeToQueueTaskInput {
        workspace_id: required_owned(input.workspace_id, "workspace id")?,
        queue_item_id: required_owned(input.queue_item_id, "queue item id")?,
        knowledge_id: required_owned(input.knowledge_id, "knowledge id")?,
    })
}

fn normalize_detach_knowledge_input(
    input: DetachKnowledgeFromQueueTaskInput,
) -> Result<DetachKnowledgeFromQueueTaskInput, WorkspaceServiceError> {
    Ok(DetachKnowledgeFromQueueTaskInput {
        workspace_id: required_owned(input.workspace_id, "workspace id")?,
        queue_item_id: required_owned(input.queue_item_id, "queue item id")?,
        knowledge_id: required_owned(input.knowledge_id, "knowledge id")?,
    })
}

fn normalize_attach_skill_input(
    input: AttachSkillToQueueTaskInput,
) -> Result<AttachSkillToQueueTaskInput, WorkspaceServiceError> {
    Ok(AttachSkillToQueueTaskInput {
        workspace_id: required_owned(input.workspace_id, "workspace id")?,
        queue_item_id: required_owned(input.queue_item_id, "queue item id")?,
        skill_id: required_owned(input.skill_id, "skill id")?,
    })
}

fn normalize_detach_skill_input(
    input: DetachSkillFromQueueTaskInput,
) -> Result<DetachSkillFromQueueTaskInput, WorkspaceServiceError> {
    Ok(DetachSkillFromQueueTaskInput {
        workspace_id: required_owned(input.workspace_id, "workspace id")?,
        queue_item_id: required_owned(input.queue_item_id, "queue item id")?,
        skill_id: required_owned(input.skill_id, "skill id")?,
    })
}

fn bounded_text(value: &str, max_chars: usize) -> BoundedText {
    let text = value.trim();
    if text.chars().count() <= max_chars {
        return BoundedText {
            capped: false,
            text: text.to_owned(),
        };
    }
    let keep_chars = max_chars.saturating_sub(12);
    BoundedText {
        capped: true,
        text: format!(
            "{}\n[truncated]",
            text.chars().take(keep_chars).collect::<String>().trim_end()
        ),
    }
}

fn estimate_tokens(value: &str) -> i64 {
    std::cmp::max(1, ((value.len() + 3) / 4) as i64)
}

fn visible_value(value: &str, fallback: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        fallback.to_owned()
    } else {
        trimmed.to_owned()
    }
}

fn required_owned(value: String, label: &str) -> Result<String, WorkspaceServiceError> {
    required_input(&value, label).map(str::to_owned)
}

fn storage_invalid_context(message: String) -> hobit_storage_sqlite::StorageError {
    hobit_storage_sqlite::StorageError::InvalidParameterName(message)
}

struct BoundedText {
    capped: bool,
    text: String,
}
