use std::fmt;

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Eq, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum KnowledgeItemType {
    Document,
    Skill,
    Workflow,
    Runbook,
    Decision,
    ValidationRule,
    KnownIssue,
    CodebaseKnowledge,
    DocumentationKnowledge,
    CommandHistorySummary,
    ExternalReference,
}

impl KnowledgeItemType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Document => "document",
            Self::Skill => "skill",
            Self::Workflow => "workflow",
            Self::Runbook => "runbook",
            Self::Decision => "decision",
            Self::ValidationRule => "validation_rule",
            Self::KnownIssue => "known_issue",
            Self::CodebaseKnowledge => "codebase_knowledge",
            Self::DocumentationKnowledge => "documentation_knowledge",
            Self::CommandHistorySummary => "command_history_summary",
            Self::ExternalReference => "external_reference",
        }
    }

    pub fn from_catalog_item_type_lossy(value: &str) -> Self {
        match value.trim() {
            "skill" => Self::Skill,
            "workflow" => Self::Workflow,
            "runbook" => Self::Runbook,
            "architecture_decision" | "decision" => Self::Decision,
            "validation_rule" => Self::ValidationRule,
            "known_issue" => Self::KnownIssue,
            "codebase_knowledge" => Self::CodebaseKnowledge,
            "documentation_knowledge" => Self::DocumentationKnowledge,
            "command_history_summary" => Self::CommandHistorySummary,
            "external_reference" => Self::ExternalReference,
            _ => Self::Document,
        }
    }
}

impl TryFrom<&str> for KnowledgeItemType {
    type Error = KnowledgeModelParseError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value.trim() {
            "document" => Ok(Self::Document),
            "skill" => Ok(Self::Skill),
            "workflow" => Ok(Self::Workflow),
            "runbook" => Ok(Self::Runbook),
            "decision" => Ok(Self::Decision),
            "validation_rule" => Ok(Self::ValidationRule),
            "known_issue" => Ok(Self::KnownIssue),
            "codebase_knowledge" => Ok(Self::CodebaseKnowledge),
            "documentation_knowledge" => Ok(Self::DocumentationKnowledge),
            "command_history_summary" => Ok(Self::CommandHistorySummary),
            "external_reference" => Ok(Self::ExternalReference),
            other => Err(KnowledgeModelParseError::unsupported("item type", other)),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum KnowledgeLifecycleStatus {
    Draft,
    Active,
    Stale,
    Archived,
    Rejected,
}

impl KnowledgeLifecycleStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Draft => "draft",
            Self::Active => "active",
            Self::Stale => "stale",
            Self::Archived => "archived",
            Self::Rejected => "rejected",
        }
    }

    pub fn is_normally_materializable(self, enabled: bool, searchable: bool) -> bool {
        enabled && searchable && matches!(self, Self::Active)
    }
}

impl TryFrom<&str> for KnowledgeLifecycleStatus {
    type Error = KnowledgeModelParseError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value.trim() {
            "draft" => Ok(Self::Draft),
            "active" => Ok(Self::Active),
            "stale" => Ok(Self::Stale),
            "archived" => Ok(Self::Archived),
            "rejected" => Ok(Self::Rejected),
            other => Err(KnowledgeModelParseError::unsupported(
                "lifecycle status",
                other,
            )),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum KnowledgeScope {
    Global,
    WorkspaceLocal,
}

impl KnowledgeScope {
    pub fn from_legacy_document_scope(value: &str) -> Self {
        if value.trim() == "global" {
            Self::Global
        } else {
            Self::WorkspaceLocal
        }
    }

    pub fn legacy_document_scope(self) -> &'static str {
        match self {
            Self::Global => "global",
            Self::WorkspaceLocal => "workspace",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum KnowledgeSourceRef {
    CodebasePath(KnowledgePathSourceRef),
    DocsPath(KnowledgePathSourceRef),
    QueueTask(KnowledgeQueueTaskSourceRef),
    QueueRun(KnowledgeQueueRunSourceRef),
    Note(KnowledgeNoteSourceRef),
    FinderSelection(KnowledgeFinderSelectionSourceRef),
    Manual(KnowledgeManualSourceRef),
    ImportFile(KnowledgeImportFileSourceRef),
}

impl KnowledgeSourceRef {
    pub fn from_legacy_fields(
        source_kind: &str,
        source_ref: &str,
        source_label: impl Into<String>,
    ) -> Self {
        let label = source_label.into();
        let selector = source_ref.trim().to_owned();

        match source_kind.trim() {
            "codebase_path" | "codebase" => Self::CodebasePath(KnowledgePathSourceRef {
                label,
                path: selector,
                selector: None,
                source_version: None,
                captured_at: None,
                redaction: None,
                cap: None,
            }),
            "docs_path" | "docs" | "documentation" => Self::DocsPath(KnowledgePathSourceRef {
                label,
                path: selector,
                selector: None,
                source_version: None,
                captured_at: None,
                redaction: None,
                cap: None,
            }),
            "queue_task" | "queue" => Self::QueueTask(KnowledgeQueueTaskSourceRef {
                label,
                queue_task_id: selector,
                source_version: None,
                captured_at: None,
                redaction: None,
                cap: None,
            }),
            "queue_run" | "run" => Self::QueueRun(KnowledgeQueueRunSourceRef {
                label,
                queue_task_id: None,
                run_id: selector,
                source_version: None,
                captured_at: None,
                redaction: None,
                cap: None,
            }),
            "note" => Self::Note(KnowledgeNoteSourceRef {
                label,
                note_id: selector,
                source_version: None,
                captured_at: None,
                redaction: None,
                cap: None,
            }),
            "finder_selection" | "finder" => {
                Self::FinderSelection(KnowledgeFinderSelectionSourceRef {
                    label,
                    selection_id: None,
                    path: selector,
                    selection_kind: None,
                    source_version: None,
                    captured_at: None,
                    redaction: None,
                    cap: None,
                })
            }
            "import_file" | "import" => Self::ImportFile(KnowledgeImportFileSourceRef {
                label,
                path: selector,
                file_name: None,
                imported_at: None,
                source_version: None,
                redaction: None,
                cap: None,
            }),
            "file" => Self::CodebasePath(KnowledgePathSourceRef {
                label,
                path: selector,
                selector: None,
                source_version: None,
                captured_at: None,
                redaction: None,
                cap: None,
            }),
            _ => Self::Manual(KnowledgeManualSourceRef {
                label,
                ref_text: selector,
                captured_at: None,
                redaction: None,
                cap: None,
            }),
        }
    }

    pub fn legacy_kind(&self) -> &'static str {
        match self {
            Self::CodebasePath(_) => "codebase_path",
            Self::DocsPath(_) => "docs_path",
            Self::QueueTask(_) => "queue_task",
            Self::QueueRun(_) => "queue_run",
            Self::Note(_) => "note",
            Self::FinderSelection(_) => "finder_selection",
            Self::Manual(_) => "manual",
            Self::ImportFile(_) => "import_file",
        }
    }

    pub fn legacy_ref(&self) -> &str {
        match self {
            Self::CodebasePath(source) | Self::DocsPath(source) => &source.path,
            Self::QueueTask(source) => &source.queue_task_id,
            Self::QueueRun(source) => &source.run_id,
            Self::Note(source) => &source.note_id,
            Self::FinderSelection(source) => &source.path,
            Self::Manual(source) => &source.ref_text,
            Self::ImportFile(source) => &source.path,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize)]
pub struct KnowledgePathSourceRef {
    pub label: String,
    pub path: String,
    pub selector: Option<String>,
    pub source_version: Option<String>,
    pub captured_at: Option<String>,
    pub redaction: Option<String>,
    pub cap: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize)]
pub struct KnowledgeQueueTaskSourceRef {
    pub label: String,
    pub queue_task_id: String,
    pub source_version: Option<String>,
    pub captured_at: Option<String>,
    pub redaction: Option<String>,
    pub cap: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize)]
pub struct KnowledgeQueueRunSourceRef {
    pub label: String,
    pub queue_task_id: Option<String>,
    pub run_id: String,
    pub source_version: Option<String>,
    pub captured_at: Option<String>,
    pub redaction: Option<String>,
    pub cap: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize)]
pub struct KnowledgeNoteSourceRef {
    pub label: String,
    pub note_id: String,
    pub source_version: Option<String>,
    pub captured_at: Option<String>,
    pub redaction: Option<String>,
    pub cap: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize)]
pub struct KnowledgeFinderSelectionSourceRef {
    pub label: String,
    pub selection_id: Option<String>,
    pub path: String,
    pub selection_kind: Option<String>,
    pub source_version: Option<String>,
    pub captured_at: Option<String>,
    pub redaction: Option<String>,
    pub cap: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize)]
pub struct KnowledgeManualSourceRef {
    pub label: String,
    pub ref_text: String,
    pub captured_at: Option<String>,
    pub redaction: Option<String>,
    pub cap: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize)]
pub struct KnowledgeImportFileSourceRef {
    pub label: String,
    pub path: String,
    pub file_name: Option<String>,
    pub imported_at: Option<String>,
    pub source_version: Option<String>,
    pub redaction: Option<String>,
    pub cap: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize)]
pub struct KnowledgeRelation {
    pub relation_id: String,
    pub relation_type: String,
    pub target_ref: String,
    pub label: String,
    pub created_at: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize)]
pub struct KnowledgeVersionSummary {
    pub knowledge_item_id: String,
    pub version_id: String,
    pub version: String,
    pub lifecycle_status: KnowledgeLifecycleStatus,
    pub created_at: String,
    pub updated_at: String,
    pub source_refs: Vec<KnowledgeSourceRef>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum KnowledgeDraftReviewDecisionKind {
    Accepted,
    Rejected,
    Edited,
    Split,
    Merged,
    Blocked,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize)]
pub struct KnowledgeDraftReviewDecision {
    pub decision_id: String,
    pub decision: KnowledgeDraftReviewDecisionKind,
    pub queue_item_id: Option<String>,
    pub run_id: Option<String>,
    pub reviewer_id: Option<String>,
    pub decided_at: String,
    pub reason: Option<String>,
    pub resulting_item_ids: Vec<String>,
    pub resulting_version_ids: Vec<String>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum KnowledgeContextSnapshotContentKind {
    Summary,
    Excerpt,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize)]
pub struct KnowledgeContextSnapshot {
    pub snapshot_id: String,
    pub source_ref_id: String,
    pub title: String,
    pub quick_summary: String,
    pub item_type: KnowledgeItemType,
    pub scope: KnowledgeScope,
    pub lifecycle_status: KnowledgeLifecycleStatus,
    pub version: String,
    pub materialized_at: String,
    pub token_estimate: u32,
    pub content_kind: KnowledgeContextSnapshotContentKind,
    pub content: String,
    pub capped: bool,
    pub warnings: Vec<KnowledgeSafetyWarning>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum KnowledgeSafetyWarningSeverity {
    Info,
    Warning,
    Blocked,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize)]
pub struct KnowledgeSafetyWarning {
    pub warning_id: String,
    pub source_ref_id: Option<String>,
    pub severity: KnowledgeSafetyWarningSeverity,
    pub code: String,
    pub message: String,
    pub created_at: String,
    pub acknowledged_at: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct KnowledgeModelParseError {
    message: String,
}

impl KnowledgeModelParseError {
    fn unsupported(label: &str, value: &str) -> Self {
        Self {
            message: format!("unsupported knowledge {label}: {value}"),
        }
    }
}

impl fmt::Display for KnowledgeModelParseError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.message.fmt(formatter)
    }
}

impl std::error::Error for KnowledgeModelParseError {}
