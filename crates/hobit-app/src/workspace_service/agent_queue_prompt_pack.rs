use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::{Component, Path, PathBuf},
};

use hobit_storage_sqlite::{
    AgentQueuePromptPackMaterializationRow, AgentQueueTaskUpdate,
    NewAgentQueuePromptPackMaterialization, NewAgentQueuePromptPackTaskMapping, NewAgentQueueTask,
    SqliteStore,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::WorkspaceServiceError;

use super::{
    agent_queue_lifecycle::{
        AGENT_QUEUE_TASK_EXECUTION_POLICY_MANUAL, AGENT_QUEUE_TASK_STATUS_DRAFT,
    },
    agent_queue_task_dependencies::dependencies_json,
    agent_queue_tasks::map_storage_agent_queue_task_error,
    agent_queue_workflow::{canonical_json_string, stable_fnv1a64_hash},
    placeholder_id, placeholder_timestamp, WorkspaceService,
};

const PROMPT_PACK_PREVIEW_STATUS_SUCCEEDED: &str = "succeeded";
const PROMPT_PACK_PREVIEW_STATUS_INVALID: &str = "invalid";
const PROMPT_PACK_MATERIALIZATION_STATUS_NOT_EVALUATED: &str = "not_evaluated";
const PROMPT_PACK_MATERIALIZATION_STATUS_NOT_MATERIALIZED: &str = "not_materialized";
const PROMPT_PACK_MATERIALIZATION_STATUS_REUSABLE: &str = "reusable";
const PROMPT_PACK_MATERIALIZATION_STATUS_CONFLICT: &str = "conflict";
const PROMPT_PACK_MATERIALIZE_STATUS_CREATED: &str = "created";
const PROMPT_PACK_MATERIALIZE_STATUS_REUSED: &str = "reused";
const PROMPT_PACK_MATERIALIZE_STATUS_FAILED: &str = "failed";
const PROMPT_PACK_TASK_SOURCE: &str = "prompt_pack";

const MAX_PACK_ID_CHARS: usize = 96;
const MAX_TASK_ID_CHARS: usize = 96;
const MAX_TASKS: usize = 100;
const MAX_DEPENDENCY_EDGES: usize = 1_000;
const MAX_TITLE_CHARS: usize = 200;
const MAX_PROMPT_CHARS: usize = 100_000;
const MAX_TAGS: usize = 20;
const MAX_TAG_CHARS: usize = 64;
const MAX_DESCRIPTION_CHARS: usize = 4_000;
const MAX_EXPECTED_OUTPUT_CHARS: usize = 8_000;
const MAX_SAFETY_NOTES_CHARS: usize = 4_000;
const MIN_PRIORITY: i64 = 0;
const MAX_PRIORITY: i64 = 5;
const DEFAULT_PRIORITY: i64 = 3;
const MAX_PROMPT_PACK_FILE_BYTES: u64 = 512 * 1024;

#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentQueuePromptPackPreviewRequest {
    pub workspace_id: String,
    pub json_payload: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentQueuePromptPackPreviewResult {
    pub status: String,
    pub preview: Option<AgentQueuePromptPackPreview>,
    pub errors: Vec<AgentQueuePromptPackPreviewDiagnostic>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<AgentQueuePromptPackSourceMetadata>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentQueuePromptPackPreviewDiagnostic {
    pub code: String,
    pub message: String,
    pub path: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentQueuePromptPackFileRequest {
    pub workspace_id: String,
    pub workspace_relative_path: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentQueuePromptPackSourceMetadata {
    pub source_kind: String,
    pub workspace_relative_path: String,
    pub source_bytes: u64,
    pub source_hash: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentQueuePromptPackPreview {
    pub workspace_id: String,
    pub pack: AgentQueuePromptPackMetadataPreview,
    pub run_settings: AgentQueuePromptPackRunSettingsPreview,
    pub task_count: usize,
    pub dependency_count: usize,
    pub tasks: Vec<AgentQueuePromptPackTaskPreview>,
    pub pack_spec_hash: String,
    pub run_settings_hash: String,
    pub dependency_spec_hash: String,
    pub full_preview_hash: String,
    pub blockers: Vec<AgentQueuePromptPackPreviewDiagnostic>,
    pub warnings: Vec<AgentQueuePromptPackPreviewDiagnostic>,
    pub would_start_workers: bool,
    pub would_create_run_links: bool,
    pub would_mutate_queue: bool,
    pub would_create: bool,
    pub would_reuse: bool,
    pub would_conflict: bool,
    pub materialization_status: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentQueuePromptPackMetadataPreview {
    pub version: u32,
    pub pack_id: String,
    pub title: String,
    pub description: Option<String>,
    pub defaults: AgentQueuePromptPackDefaultsPreview,
    pub constraints: AgentQueuePromptPackConstraintsPreview,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentQueuePromptPackDefaultsPreview {
    pub status: String,
    pub priority: i64,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentQueuePromptPackConstraintsPreview {
    pub no_auto_run: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentQueuePromptPackRunSettingsPreview {
    pub execution_target: Option<AgentQueuePromptPackExecutionTargetPreview>,
    pub execution_policy: String,
    pub sandbox: Option<String>,
    pub approval_policy: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentQueuePromptPackExecutionTargetPreview {
    pub kind: String,
    pub provider_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentQueuePromptPackTaskPreview {
    pub id: String,
    pub queue_task_id: Option<String>,
    pub title: String,
    pub prompt: String,
    pub depends_on: Vec<String>,
    pub tags: Vec<String>,
    pub priority: i64,
    pub status: String,
    pub expected_output: Option<String>,
    pub safety: Option<AgentQueuePromptPackSafetyPreview>,
    pub task_spec_hash: String,
    pub dependency_queue_task_ids: Vec<String>,
    pub would_create: bool,
    pub would_reuse: bool,
    pub would_conflict: bool,
    pub materialization_status: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentQueuePromptPackSafetyPreview {
    pub notes: Option<String>,
    pub sensitive_text_warning: Option<bool>,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentQueuePromptPackMaterializeRequest {
    pub workspace_id: String,
    pub json_payload: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentQueuePromptPackMaterializeResult {
    pub status: String,
    pub pack_id: Option<String>,
    pub pack_spec_hash: Option<String>,
    pub run_settings_hash: Option<String>,
    pub dependency_spec_hash: Option<String>,
    pub full_preview_hash: Option<String>,
    pub task_count: usize,
    pub created_count: usize,
    pub reused_count: usize,
    pub conflict_count: usize,
    pub tasks: Vec<AgentQueuePromptPackMaterializedTaskResult>,
    pub errors: Vec<AgentQueuePromptPackPreviewDiagnostic>,
    pub would_start_workers: bool,
    pub would_create_run_links: bool,
    pub would_mutate_queue: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<AgentQueuePromptPackSourceMetadata>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentQueuePromptPackMaterializedTaskResult {
    pub pack_task_id: String,
    pub queue_task_id: Option<String>,
    pub task_spec_hash: String,
    pub status: String,
    pub dependency_queue_task_ids: Vec<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PromptPackInput {
    version: u32,
    pack_id: String,
    title: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    defaults: Option<PromptPackDefaultsInput>,
    #[serde(default)]
    run_settings: Option<PromptPackRunSettingsInput>,
    #[serde(default)]
    constraints: Option<PromptPackConstraintsInput>,
    tasks: Vec<PromptPackTaskInput>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PromptPackDefaultsInput {
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    priority: Option<i64>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PromptPackRunSettingsInput {
    #[serde(default)]
    execution_target: Option<PromptPackExecutionTargetInput>,
    #[serde(default)]
    execution_policy: Option<String>,
    #[serde(default)]
    sandbox: Option<String>,
    #[serde(default)]
    approval_policy: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PromptPackExecutionTargetInput {
    #[serde(default)]
    kind: Option<String>,
    #[serde(default)]
    provider_id: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PromptPackConstraintsInput {
    #[serde(default)]
    no_auto_run: Option<bool>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PromptPackTaskInput {
    id: String,
    title: String,
    prompt: String,
    #[serde(default)]
    depends_on: Vec<String>,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    priority: Option<i64>,
    #[serde(default)]
    expected_output: Option<String>,
    #[serde(default)]
    safety: Option<PromptPackSafetyInput>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PromptPackSafetyInput {
    #[serde(default)]
    notes: Option<String>,
    #[serde(default)]
    sensitive_text_warning: Option<bool>,
}

pub fn parse_and_preview_agent_queue_prompt_pack(
    request: AgentQueuePromptPackPreviewRequest,
) -> AgentQueuePromptPackPreviewResult {
    let workspace_id = request.workspace_id.trim().to_owned();
    if workspace_id.is_empty() {
        return invalid_result(diagnostic(
            "missing_workspace_id",
            "Prompt pack preview requires a workspaceId supplied by the backend request context.",
            Some("$.workspaceId"),
        ));
    }

    let value = match serde_json::from_str::<Value>(&request.json_payload) {
        Ok(value) => value,
        Err(error) => {
            return invalid_result(diagnostic(
                "invalid_json",
                format!("Prompt pack JSON is invalid: {error}"),
                None::<String>,
            ));
        }
    };

    if !value.is_object() {
        return invalid_result(diagnostic(
            "invalid_json_object",
            "Prompt pack JSON must be an object.",
            Some("$"),
        ));
    }

    if let Some(error) = find_forbidden_key(&value, "$") {
        return invalid_result(error);
    }
    if let Some(error) = validate_json_shape(&value) {
        return invalid_result(error);
    }
    if let Some(error) = validate_required_keys(&value) {
        return invalid_result(error);
    }

    let input = match serde_json::from_value::<PromptPackInput>(value) {
        Ok(input) => input,
        Err(error) => {
            return invalid_result(diagnostic(
                "invalid_schema",
                format!("Prompt pack JSON does not match the v1 schema: {error}"),
                None::<String>,
            ));
        }
    };

    match normalize_prompt_pack(workspace_id, input) {
        Ok(preview) => AgentQueuePromptPackPreviewResult {
            status: PROMPT_PACK_PREVIEW_STATUS_SUCCEEDED.to_owned(),
            preview: Some(preview),
            errors: Vec::new(),
            source: None,
        },
        Err(error) => invalid_result(error),
    }
}

impl WorkspaceService {
    pub fn preview_agent_queue_prompt_pack(
        &self,
        request: AgentQueuePromptPackPreviewRequest,
    ) -> Result<AgentQueuePromptPackPreviewResult, WorkspaceServiceError> {
        let mut result = parse_and_preview_agent_queue_prompt_pack(request);
        if let Some(preview) = result.preview.as_mut() {
            evaluate_prompt_pack_preview_state(&self.store, preview)
                .map_err(map_storage_agent_queue_task_error)?;
        }

        Ok(result)
    }

    pub fn preview_agent_queue_prompt_pack_file(
        &self,
        request: AgentQueuePromptPackFileRequest,
    ) -> Result<AgentQueuePromptPackPreviewResult, WorkspaceServiceError> {
        let source = self.read_prompt_pack_workspace_file(&request)?;
        let mut result =
            self.preview_agent_queue_prompt_pack(AgentQueuePromptPackPreviewRequest {
                workspace_id: request.workspace_id,
                json_payload: source.json_payload,
            })?;
        result.source = Some(source.metadata);
        Ok(result)
    }

    pub fn materialize_agent_queue_prompt_pack(
        &self,
        request: AgentQueuePromptPackMaterializeRequest,
    ) -> Result<AgentQueuePromptPackMaterializeResult, WorkspaceServiceError> {
        let parsed =
            parse_and_preview_agent_queue_prompt_pack(AgentQueuePromptPackPreviewRequest {
                workspace_id: request.workspace_id,
                json_payload: request.json_payload,
            });
        let Some(preview) = parsed.preview else {
            return Ok(materialize_failed_result(parsed.errors));
        };

        self.store
            .with_immediate_transaction(|store| {
                materialize_prompt_pack_in_transaction(store, &preview)
            })
            .map_err(map_storage_agent_queue_task_error)
    }

    pub fn materialize_agent_queue_prompt_pack_file(
        &self,
        request: AgentQueuePromptPackFileRequest,
    ) -> Result<AgentQueuePromptPackMaterializeResult, WorkspaceServiceError> {
        let source = self.read_prompt_pack_workspace_file(&request)?;
        let mut result =
            self.materialize_agent_queue_prompt_pack(AgentQueuePromptPackMaterializeRequest {
                workspace_id: request.workspace_id,
                json_payload: source.json_payload,
            })?;
        result.source = Some(source.metadata);
        Ok(result)
    }

    fn read_prompt_pack_workspace_file(
        &self,
        request: &AgentQueuePromptPackFileRequest,
    ) -> Result<PromptPackWorkspaceFileSource, WorkspaceServiceError> {
        let workspace_id = required_text(&request.workspace_id, "workspace id")?.to_owned();
        let relative_path =
            normalize_prompt_pack_workspace_relative_path(&request.workspace_relative_path)?;
        let workspace = self
            .store
            .get_workspace(&workspace_id)?
            .ok_or_else(|| WorkspaceServiceError::InvalidInput("workspace not found".to_owned()))?;
        let root_path = workspace
            .root_path
            .as_deref()
            .and_then(non_empty_text)
            .ok_or_else(|| {
                WorkspaceServiceError::InvalidInput(
                    "workspace root path is required for prompt-pack file import".to_owned(),
                )
            })?;
        let canonical_root = Path::new(root_path).canonicalize().map_err(|_| {
            WorkspaceServiceError::InvalidInput(
                "workspace root path could not be resolved".to_owned(),
            )
        })?;
        if !canonical_root.is_dir() {
            return Err(WorkspaceServiceError::InvalidInput(
                "workspace root path must resolve to a directory".to_owned(),
            ));
        }

        let candidate_path = canonical_root.join(Path::new(&relative_path));
        let metadata = fs::symlink_metadata(&candidate_path).map_err(|_| {
            WorkspaceServiceError::InvalidInput(
                "prompt-pack workspace file could not be read".to_owned(),
            )
        })?;
        if metadata.file_type().is_symlink() {
            return Err(WorkspaceServiceError::InvalidInput(
                "prompt-pack workspace file must not be a symlink".to_owned(),
            ));
        }
        if !metadata.is_file() {
            return Err(WorkspaceServiceError::InvalidInput(
                "prompt-pack workspace path must point to a file".to_owned(),
            ));
        }
        if metadata.len() > MAX_PROMPT_PACK_FILE_BYTES {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "prompt-pack workspace file is too large. Limit is {MAX_PROMPT_PACK_FILE_BYTES} bytes"
            )));
        }

        let canonical_file = candidate_path.canonicalize().map_err(|_| {
            WorkspaceServiceError::InvalidInput(
                "prompt-pack workspace file path could not be resolved".to_owned(),
            )
        })?;
        if !canonical_file.starts_with(&canonical_root) {
            return Err(WorkspaceServiceError::InvalidInput(
                "prompt-pack workspace file escaped the workspace root".to_owned(),
            ));
        }

        let bytes = fs::read(&canonical_file).map_err(|_| {
            WorkspaceServiceError::InvalidInput(
                "prompt-pack workspace file could not be read".to_owned(),
            )
        })?;
        if bytes.len() as u64 > MAX_PROMPT_PACK_FILE_BYTES {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "prompt-pack workspace file is too large. Limit is {MAX_PROMPT_PACK_FILE_BYTES} bytes"
            )));
        }
        let json_payload = String::from_utf8(bytes).map_err(|_| {
            WorkspaceServiceError::InvalidInput(
                "prompt-pack workspace file must be valid UTF-8 text".to_owned(),
            )
        })?;
        let source_bytes = json_payload.len() as u64;
        let source_hash = stable_fnv1a64_hash(
            "prompt_pack_workspace_source",
            &canonical_json_string(&json!({
                "workspaceRelativePath": relative_path,
                "sourceBytes": source_bytes,
                "jsonPayload": json_payload,
            })),
        );

        Ok(PromptPackWorkspaceFileSource {
            json_payload,
            metadata: AgentQueuePromptPackSourceMetadata {
                source_kind: "workspace_path".to_owned(),
                workspace_relative_path: relative_path,
                source_bytes,
                source_hash,
            },
        })
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct PromptPackWorkspaceFileSource {
    json_payload: String,
    metadata: AgentQueuePromptPackSourceMetadata,
}

fn materialize_prompt_pack_in_transaction(
    store: &SqliteStore,
    preview: &AgentQueuePromptPackPreview,
) -> Result<AgentQueuePromptPackMaterializeResult, hobit_storage_sqlite::StorageError> {
    if store.get_workspace(&preview.workspace_id)?.is_none() {
        return Ok(materialize_conflict_result(
            preview,
            diagnostic(
                "workspace_not_found",
                "Prompt pack materialization requires an existing workspace.",
                Some("$.workspaceId"),
            ),
        ));
    }

    match materialization_state(store, preview)? {
        PromptPackMaterializationState::Reusable(validated) => Ok(materialize_reused_result(
            preview,
            validated.queue_task_ids_by_pack_task_id,
            validated.dependency_queue_task_ids_by_pack_task_id,
        )),
        PromptPackMaterializationState::Conflict(error) => {
            Ok(materialize_conflict_result(preview, error))
        }
        PromptPackMaterializationState::NotMaterialized => create_prompt_pack_tasks(store, preview),
    }
}

fn create_prompt_pack_tasks(
    store: &SqliteStore,
    preview: &AgentQueuePromptPackPreview,
) -> Result<AgentQueuePromptPackMaterializeResult, hobit_storage_sqlite::StorageError> {
    let created_at = placeholder_timestamp();
    store.insert_agent_queue_prompt_pack_materialization(
        NewAgentQueuePromptPackMaterialization {
            workspace_id: &preview.workspace_id,
            pack_id: &preview.pack.pack_id,
            title: &preview.pack.title,
            description: preview.pack.description.as_deref(),
            pack_spec_hash: &preview.pack_spec_hash,
            run_settings_hash: &preview.run_settings_hash,
            dependency_spec_hash: &preview.dependency_spec_hash,
            full_preview_hash: &preview.full_preview_hash,
            task_count: preview.task_count as i64,
            created_at: Some(&created_at),
            updated_at: Some(&created_at),
        },
    )?;

    let mut sorted_tasks = preview.tasks.iter().collect::<Vec<_>>();
    sorted_tasks.sort_by(|left, right| left.id.cmp(&right.id));

    let mut queue_task_ids_by_pack_task_id = BTreeMap::<String, String>::new();
    let mut context_by_pack_task_id = BTreeMap::<String, String>::new();

    for task in &sorted_tasks {
        let queue_task_id = placeholder_id("queue_task_prompt_pack_");
        let context_json = prompt_pack_task_context_json(preview, task)?;
        store.create_agent_queue_task(NewAgentQueueTask {
            queue_item_id: &queue_task_id,
            workspace_id: &preview.workspace_id,
            title: &task.title,
            description: "",
            prompt: &task.prompt,
            status: &task.status,
            priority: task.priority,
            depends_on: Some("[]"),
            execution_policy: Some(AGENT_QUEUE_TASK_EXECUTION_POLICY_MANUAL),
            execution_workspace: None,
            codex_executable: None,
            sandbox: preview.run_settings.sandbox.as_deref(),
            approval_policy: preview.run_settings.approval_policy.as_deref(),
            context_json: Some(&context_json),
            created_at: Some(&created_at),
            updated_at: Some(&created_at),
        })?;
        store.insert_agent_queue_prompt_pack_task_mapping(NewAgentQueuePromptPackTaskMapping {
            workspace_id: &preview.workspace_id,
            pack_id: &preview.pack.pack_id,
            pack_task_id: &task.id,
            queue_task_id: &queue_task_id,
            task_spec_hash: &task.task_spec_hash,
            created_at: Some(&created_at),
            updated_at: Some(&created_at),
        })?;
        queue_task_ids_by_pack_task_id.insert(task.id.clone(), queue_task_id);
        context_by_pack_task_id.insert(task.id.clone(), context_json);
    }

    let mut dependency_queue_task_ids_by_pack_task_id = BTreeMap::<String, Vec<String>>::new();
    for task in &sorted_tasks {
        let queue_task_id = queue_task_ids_by_pack_task_id
            .get(&task.id)
            .cloned()
            .ok_or_else(|| {
                storage_invalid_input(format!("missing queue task id for {}", task.id))
            })?;
        let dependency_queue_task_ids =
            dependency_queue_task_ids(task, &queue_task_ids_by_pack_task_id)?;
        let dependency_json = dependencies_json(&dependency_queue_task_ids)?;
        let context_json = context_by_pack_task_id
            .get(&task.id)
            .ok_or_else(|| storage_invalid_input(format!("missing context for {}", task.id)))?;
        let updated_task = store.update_agent_queue_task(
            &preview.workspace_id,
            &queue_task_id,
            AgentQueueTaskUpdate {
                title: &task.title,
                description: "",
                prompt: &task.prompt,
                status: &task.status,
                priority: task.priority,
                depends_on: Some(&dependency_json),
                execution_policy: Some(AGENT_QUEUE_TASK_EXECUTION_POLICY_MANUAL),
                execution_workspace: None,
                codex_executable: None,
                sandbox: preview.run_settings.sandbox.as_deref(),
                approval_policy: preview.run_settings.approval_policy.as_deref(),
                context_json: Some(context_json),
                updated_at: Some(&created_at),
            },
        )?;
        if updated_task.is_none() {
            return Err(storage_invalid_input(format!(
                "created prompt pack queue task disappeared before dependency update: {queue_task_id}"
            )));
        }
        dependency_queue_task_ids_by_pack_task_id
            .insert(task.id.clone(), dependency_queue_task_ids);
    }

    store.touch_workspace(&preview.workspace_id)?;

    Ok(materialize_created_result(
        preview,
        queue_task_ids_by_pack_task_id,
        dependency_queue_task_ids_by_pack_task_id,
    ))
}

fn evaluate_prompt_pack_preview_state(
    store: &SqliteStore,
    preview: &mut AgentQueuePromptPackPreview,
) -> Result<(), hobit_storage_sqlite::StorageError> {
    match materialization_state(store, preview)? {
        PromptPackMaterializationState::NotMaterialized => {
            preview.materialization_status =
                PROMPT_PACK_MATERIALIZATION_STATUS_NOT_MATERIALIZED.to_owned();
            preview.would_create = true;
            preview.would_reuse = false;
            preview.would_conflict = false;
            preview.would_mutate_queue = false;
            for task in &mut preview.tasks {
                task.materialization_status =
                    PROMPT_PACK_MATERIALIZATION_STATUS_NOT_MATERIALIZED.to_owned();
                task.would_create = true;
                task.would_reuse = false;
                task.would_conflict = false;
                task.queue_task_id = None;
                task.dependency_queue_task_ids.clear();
            }
        }
        PromptPackMaterializationState::Reusable(validated) => {
            preview.materialization_status = PROMPT_PACK_MATERIALIZATION_STATUS_REUSABLE.to_owned();
            preview.would_create = false;
            preview.would_reuse = true;
            preview.would_conflict = false;
            preview.would_mutate_queue = false;
            for task in &mut preview.tasks {
                task.materialization_status =
                    PROMPT_PACK_MATERIALIZATION_STATUS_REUSABLE.to_owned();
                task.would_create = false;
                task.would_reuse = true;
                task.would_conflict = false;
                task.queue_task_id = validated
                    .queue_task_ids_by_pack_task_id
                    .get(&task.id)
                    .cloned();
                task.dependency_queue_task_ids = validated
                    .dependency_queue_task_ids_by_pack_task_id
                    .get(&task.id)
                    .cloned()
                    .unwrap_or_default();
            }
        }
        PromptPackMaterializationState::Conflict(error) => {
            preview.materialization_status = PROMPT_PACK_MATERIALIZATION_STATUS_CONFLICT.to_owned();
            preview.would_create = false;
            preview.would_reuse = false;
            preview.would_conflict = true;
            preview.would_mutate_queue = false;
            preview.blockers.push(error);
            for task in &mut preview.tasks {
                task.materialization_status =
                    PROMPT_PACK_MATERIALIZATION_STATUS_CONFLICT.to_owned();
                task.would_create = false;
                task.would_reuse = false;
                task.would_conflict = true;
                task.queue_task_id = None;
                task.dependency_queue_task_ids.clear();
            }
        }
    }

    Ok(())
}

fn materialization_state(
    store: &SqliteStore,
    preview: &AgentQueuePromptPackPreview,
) -> Result<PromptPackMaterializationState, hobit_storage_sqlite::StorageError> {
    let Some(existing) = store.get_agent_queue_prompt_pack_materialization(
        &preview.workspace_id,
        &preview.pack.pack_id,
    )?
    else {
        return Ok(PromptPackMaterializationState::NotMaterialized);
    };

    if existing.pack_spec_hash != preview.pack_spec_hash {
        return Ok(PromptPackMaterializationState::Conflict(diagnostic(
            "prompt_pack_spec_conflict",
            "Prompt pack has already been materialized in this workspace with a different spec hash.",
            Some("$.packId"),
        )));
    }
    if existing.run_settings_hash != preview.run_settings_hash
        || existing.dependency_spec_hash != preview.dependency_spec_hash
        || existing.full_preview_hash != preview.full_preview_hash
        || existing.task_count != preview.task_count as i64
    {
        return Ok(PromptPackMaterializationState::Conflict(diagnostic(
            "prompt_pack_mapping_integrity_conflict",
            "Prompt pack materialization record is inconsistent with the current preview hashes.",
            Some("$.packId"),
        )));
    }

    validate_existing_materialization(store, preview, &existing)
}

fn validate_existing_materialization(
    store: &SqliteStore,
    preview: &AgentQueuePromptPackPreview,
    _existing: &AgentQueuePromptPackMaterializationRow,
) -> Result<PromptPackMaterializationState, hobit_storage_sqlite::StorageError> {
    let mappings = store
        .list_agent_queue_prompt_pack_task_mappings(&preview.workspace_id, &preview.pack.pack_id)?;
    if mappings.len() != preview.task_count {
        return Ok(PromptPackMaterializationState::Conflict(mapping_conflict(
            "Prompt pack task mapping count does not match materialized pack task count.",
        )));
    }

    let mappings_by_pack_task_id = mappings
        .into_iter()
        .map(|mapping| (mapping.pack_task_id.clone(), mapping))
        .collect::<BTreeMap<_, _>>();
    let mut queue_task_ids_by_pack_task_id = BTreeMap::<String, String>::new();
    let mut durable_tasks_by_pack_task_id =
        BTreeMap::<String, hobit_storage_sqlite::AgentQueueTaskRow>::new();

    for task in &preview.tasks {
        let Some(mapping) = mappings_by_pack_task_id.get(&task.id) else {
            return Ok(PromptPackMaterializationState::Conflict(mapping_conflict(
                format!(
                    "prompt pack task mapping is missing for pack task {}",
                    task.id
                ),
            )));
        };
        if mapping.task_spec_hash != task.task_spec_hash {
            return Ok(PromptPackMaterializationState::Conflict(mapping_conflict(
                format!(
                    "prompt pack task mapping hash differs for pack task {}",
                    task.id
                ),
            )));
        }
        let Some(durable_task) =
            store.get_agent_queue_task(&preview.workspace_id, &mapping.queue_task_id)?
        else {
            return Ok(PromptPackMaterializationState::Conflict(mapping_conflict(
                format!(
                    "prompt pack mapped queue task is missing: {}",
                    mapping.queue_task_id
                ),
            )));
        };
        if let Some(error) = validate_durable_task_matches_preview(preview, task, &durable_task) {
            return Ok(PromptPackMaterializationState::Conflict(error));
        }
        queue_task_ids_by_pack_task_id.insert(task.id.clone(), mapping.queue_task_id.clone());
        durable_tasks_by_pack_task_id.insert(task.id.clone(), durable_task);
    }

    let mut dependency_queue_task_ids_by_pack_task_id = BTreeMap::<String, Vec<String>>::new();
    for task in &preview.tasks {
        let expected_dependency_ids =
            match dependency_queue_task_ids(task, &queue_task_ids_by_pack_task_id) {
                Ok(dependencies) => dependencies,
                Err(error) => {
                    return Ok(PromptPackMaterializationState::Conflict(mapping_conflict(
                        error.to_string(),
                    )));
                }
            };
        let durable_task = durable_tasks_by_pack_task_id.get(&task.id).ok_or_else(|| {
            storage_invalid_input(format!("missing durable task for {}", task.id))
        })?;
        let mut actual_dependency_ids =
            match parse_queue_task_dependency_ids(&durable_task.depends_on) {
                Ok(dependencies) => dependencies,
                Err(error) => {
                    return Ok(PromptPackMaterializationState::Conflict(mapping_conflict(
                        error.to_string(),
                    )));
                }
            };
        actual_dependency_ids.sort();
        if actual_dependency_ids != expected_dependency_ids {
            return Ok(PromptPackMaterializationState::Conflict(mapping_conflict(
                format!(
                    "prompt pack mapped queue task dependencies differ for pack task {}",
                    task.id
                ),
            )));
        }
        dependency_queue_task_ids_by_pack_task_id.insert(task.id.clone(), expected_dependency_ids);
    }

    Ok(PromptPackMaterializationState::Reusable(
        ValidatedPromptPackMaterialization {
            queue_task_ids_by_pack_task_id,
            dependency_queue_task_ids_by_pack_task_id,
        },
    ))
}

fn validate_durable_task_matches_preview(
    preview: &AgentQueuePromptPackPreview,
    task: &AgentQueuePromptPackTaskPreview,
    durable_task: &hobit_storage_sqlite::AgentQueueTaskRow,
) -> Option<AgentQueuePromptPackPreviewDiagnostic> {
    if durable_task.title != task.title
        || durable_task.prompt != task.prompt
        || durable_task.priority != task.priority
        || durable_task.execution_policy != AGENT_QUEUE_TASK_EXECUTION_POLICY_MANUAL
        || durable_task.execution_workspace.is_some()
        || durable_task.codex_executable.is_some()
        || durable_task.sandbox != preview.run_settings.sandbox
        || durable_task.approval_policy != preview.run_settings.approval_policy
    {
        return Some(mapping_conflict(format!(
            "prompt pack mapped queue task no longer matches pack task {}",
            task.id
        )));
    }

    None
}

fn dependency_queue_task_ids(
    task: &AgentQueuePromptPackTaskPreview,
    queue_task_ids_by_pack_task_id: &BTreeMap<String, String>,
) -> Result<Vec<String>, hobit_storage_sqlite::StorageError> {
    task.depends_on
        .iter()
        .map(|dependency_pack_task_id| {
            queue_task_ids_by_pack_task_id
                .get(dependency_pack_task_id)
                .cloned()
                .ok_or_else(|| {
                    storage_invalid_input(format!(
                        "missing queue task id for dependency pack task {dependency_pack_task_id}"
                    ))
                })
        })
        .collect()
}

fn parse_queue_task_dependency_ids(
    depends_on_json: &str,
) -> Result<Vec<String>, hobit_storage_sqlite::StorageError> {
    serde_json::from_str::<Vec<String>>(depends_on_json).map_err(|error| {
        storage_invalid_input(format!(
            "queue task dependencies could not be parsed during prompt pack materialization: {error}"
        ))
    })
}

fn prompt_pack_task_context_json(
    preview: &AgentQueuePromptPackPreview,
    task: &AgentQueuePromptPackTaskPreview,
) -> Result<String, hobit_storage_sqlite::StorageError> {
    let mut context = json!({
        "attachedKnowledgeRefs": [],
        "attachedSkillRefs": [],
        "attachedKnowledgeSnapshots": [],
        "contextWarnings": [],
        "contextTokenBudget": {
            "estimatedTokens": 0,
            "maxTokens": 1600,
            "overBudget": false,
        },
        "materializedAt": null,
        "source": PROMPT_PACK_TASK_SOURCE,
        "packId": preview.pack.pack_id.clone(),
        "packSpecHash": preview.pack_spec_hash.clone(),
        "runSettingsHash": preview.run_settings_hash.clone(),
        "dependencySpecHash": preview.dependency_spec_hash.clone(),
        "fullPreviewHash": preview.full_preview_hash.clone(),
        "packTaskId": task.id.clone(),
        "taskSpecHash": task.task_spec_hash.clone(),
        "tags": task.tags.clone(),
        "expectedOutput": task.expected_output.clone(),
        "safety": task.safety.clone(),
    });
    if let Some(execution_target) = preview.run_settings.execution_target.as_ref() {
        context["executionTarget"] = execution_target_hash_value(execution_target);
    }

    serde_json::to_string(&context).map_err(|error| {
        storage_invalid_input(format!(
            "prompt pack task context could not be serialized: {error}"
        ))
    })
}

fn materialize_created_result(
    preview: &AgentQueuePromptPackPreview,
    queue_task_ids_by_pack_task_id: BTreeMap<String, String>,
    dependency_queue_task_ids_by_pack_task_id: BTreeMap<String, Vec<String>>,
) -> AgentQueuePromptPackMaterializeResult {
    materialize_success_result(
        preview,
        PROMPT_PACK_MATERIALIZE_STATUS_CREATED,
        preview.task_count,
        0,
        true,
        queue_task_ids_by_pack_task_id,
        dependency_queue_task_ids_by_pack_task_id,
    )
}

fn materialize_reused_result(
    preview: &AgentQueuePromptPackPreview,
    queue_task_ids_by_pack_task_id: BTreeMap<String, String>,
    dependency_queue_task_ids_by_pack_task_id: BTreeMap<String, Vec<String>>,
) -> AgentQueuePromptPackMaterializeResult {
    materialize_success_result(
        preview,
        PROMPT_PACK_MATERIALIZE_STATUS_REUSED,
        0,
        preview.task_count,
        false,
        queue_task_ids_by_pack_task_id,
        dependency_queue_task_ids_by_pack_task_id,
    )
}

fn materialize_success_result(
    preview: &AgentQueuePromptPackPreview,
    status: &str,
    created_count: usize,
    reused_count: usize,
    would_mutate_queue: bool,
    queue_task_ids_by_pack_task_id: BTreeMap<String, String>,
    dependency_queue_task_ids_by_pack_task_id: BTreeMap<String, Vec<String>>,
) -> AgentQueuePromptPackMaterializeResult {
    AgentQueuePromptPackMaterializeResult {
        status: status.to_owned(),
        pack_id: Some(preview.pack.pack_id.clone()),
        pack_spec_hash: Some(preview.pack_spec_hash.clone()),
        run_settings_hash: Some(preview.run_settings_hash.clone()),
        dependency_spec_hash: Some(preview.dependency_spec_hash.clone()),
        full_preview_hash: Some(preview.full_preview_hash.clone()),
        task_count: preview.task_count,
        created_count,
        reused_count,
        conflict_count: 0,
        tasks: preview
            .tasks
            .iter()
            .map(|task| AgentQueuePromptPackMaterializedTaskResult {
                pack_task_id: task.id.clone(),
                queue_task_id: queue_task_ids_by_pack_task_id.get(&task.id).cloned(),
                task_spec_hash: task.task_spec_hash.clone(),
                status: status.to_owned(),
                dependency_queue_task_ids: dependency_queue_task_ids_by_pack_task_id
                    .get(&task.id)
                    .cloned()
                    .unwrap_or_default(),
            })
            .collect(),
        errors: Vec::new(),
        would_start_workers: false,
        would_create_run_links: false,
        would_mutate_queue,
        source: None,
    }
}

fn materialize_conflict_result(
    preview: &AgentQueuePromptPackPreview,
    error: AgentQueuePromptPackPreviewDiagnostic,
) -> AgentQueuePromptPackMaterializeResult {
    AgentQueuePromptPackMaterializeResult {
        status: PROMPT_PACK_MATERIALIZATION_STATUS_CONFLICT.to_owned(),
        pack_id: Some(preview.pack.pack_id.clone()),
        pack_spec_hash: Some(preview.pack_spec_hash.clone()),
        run_settings_hash: Some(preview.run_settings_hash.clone()),
        dependency_spec_hash: Some(preview.dependency_spec_hash.clone()),
        full_preview_hash: Some(preview.full_preview_hash.clone()),
        task_count: preview.task_count,
        created_count: 0,
        reused_count: 0,
        conflict_count: preview.task_count,
        tasks: preview
            .tasks
            .iter()
            .map(|task| AgentQueuePromptPackMaterializedTaskResult {
                pack_task_id: task.id.clone(),
                queue_task_id: None,
                task_spec_hash: task.task_spec_hash.clone(),
                status: PROMPT_PACK_MATERIALIZATION_STATUS_CONFLICT.to_owned(),
                dependency_queue_task_ids: Vec::new(),
            })
            .collect(),
        errors: vec![error],
        would_start_workers: false,
        would_create_run_links: false,
        would_mutate_queue: false,
        source: None,
    }
}

fn materialize_failed_result(
    errors: Vec<AgentQueuePromptPackPreviewDiagnostic>,
) -> AgentQueuePromptPackMaterializeResult {
    AgentQueuePromptPackMaterializeResult {
        status: PROMPT_PACK_MATERIALIZE_STATUS_FAILED.to_owned(),
        pack_id: None,
        pack_spec_hash: None,
        run_settings_hash: None,
        dependency_spec_hash: None,
        full_preview_hash: None,
        task_count: 0,
        created_count: 0,
        reused_count: 0,
        conflict_count: 0,
        tasks: Vec::new(),
        errors,
        would_start_workers: false,
        would_create_run_links: false,
        would_mutate_queue: false,
        source: None,
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct ValidatedPromptPackMaterialization {
    queue_task_ids_by_pack_task_id: BTreeMap<String, String>,
    dependency_queue_task_ids_by_pack_task_id: BTreeMap<String, Vec<String>>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
enum PromptPackMaterializationState {
    NotMaterialized,
    Reusable(ValidatedPromptPackMaterialization),
    Conflict(AgentQueuePromptPackPreviewDiagnostic),
}

fn storage_invalid_input(message: String) -> hobit_storage_sqlite::StorageError {
    hobit_storage_sqlite::StorageError::InvalidParameterName(message)
}

fn mapping_conflict(message: impl Into<String>) -> AgentQueuePromptPackPreviewDiagnostic {
    diagnostic(
        "prompt_pack_mapping_integrity_conflict",
        message,
        Some("$.packId"),
    )
}

fn normalize_prompt_pack(
    workspace_id: String,
    input: PromptPackInput,
) -> Result<AgentQueuePromptPackPreview, AgentQueuePromptPackPreviewDiagnostic> {
    if input.version != 1 {
        return Err(diagnostic(
            "unsupported_version",
            "Prompt pack version must be exactly 1.",
            Some("$.version"),
        ));
    }

    validate_slug(&input.pack_id, "packId", "$.packId", MAX_PACK_ID_CHARS)?;
    validate_required_bounded_string(&input.title, "title", "$.title", MAX_TITLE_CHARS)?;
    if let Some(description) = input.description.as_deref() {
        validate_optional_bounded_string(
            description,
            "description",
            "$.description",
            MAX_DESCRIPTION_CHARS,
        )?;
    }

    if input.tasks.is_empty() {
        return Err(diagnostic(
            "missing_tasks",
            "Prompt pack tasks must contain at least one task.",
            Some("$.tasks"),
        ));
    }
    if input.tasks.len() > MAX_TASKS {
        return Err(diagnostic(
            "too_many_tasks",
            format!("Prompt pack tasks exceed the limit of {MAX_TASKS}."),
            Some("$.tasks"),
        ));
    }

    let defaults = normalize_defaults(input.defaults)?;
    let constraints = normalize_constraints(input.constraints)?;
    let run_settings = normalize_run_settings(input.run_settings)?;

    let mut known_task_ids = BTreeSet::new();
    for (index, task) in input.tasks.iter().enumerate() {
        validate_slug(
            &task.id,
            "task id",
            &format!("$.tasks[{index}].id"),
            MAX_TASK_ID_CHARS,
        )?;
        if !known_task_ids.insert(task.id.clone()) {
            return Err(diagnostic(
                "duplicate_task_id",
                format!("Prompt pack contains duplicate task id \"{}\".", task.id),
                Some(format!("$.tasks[{index}].id")),
            ));
        }
    }

    let mut tasks = Vec::with_capacity(input.tasks.len());
    let mut dependencies_by_task = BTreeMap::<String, Vec<String>>::new();
    let mut dependency_count = 0_usize;

    for (index, task) in input.tasks.into_iter().enumerate() {
        validate_required_bounded_string(
            &task.title,
            "task title",
            &format!("$.tasks[{index}].title"),
            MAX_TITLE_CHARS,
        )?;
        validate_prompt(&task.prompt, &format!("$.tasks[{index}].prompt"))?;

        let tags = normalize_tags(task.tags, index)?;
        let priority = task.priority.unwrap_or(defaults.priority);
        validate_priority(priority, &format!("$.tasks[{index}].priority"))?;
        if let Some(expected_output) = task.expected_output.as_deref() {
            validate_optional_bounded_string(
                expected_output,
                "expectedOutput",
                &format!("$.tasks[{index}].expectedOutput"),
                MAX_EXPECTED_OUTPUT_CHARS,
            )?;
        }
        let safety = normalize_safety(task.safety, index)?;
        let depends_on = normalize_dependencies(task.depends_on, &task.id, &known_task_ids, index)?;
        dependency_count = dependency_count.saturating_add(depends_on.len());
        if dependency_count > MAX_DEPENDENCY_EDGES {
            return Err(diagnostic(
                "too_many_dependencies",
                format!("Prompt pack dependencies exceed the limit of {MAX_DEPENDENCY_EDGES}."),
                Some("$.tasks"),
            ));
        }
        dependencies_by_task.insert(task.id.clone(), depends_on.clone());

        let mut preview = AgentQueuePromptPackTaskPreview {
            id: task.id,
            queue_task_id: None,
            title: task.title,
            prompt: task.prompt,
            depends_on,
            tags,
            priority,
            status: defaults.status.clone(),
            expected_output: task.expected_output,
            safety,
            task_spec_hash: String::new(),
            dependency_queue_task_ids: Vec::new(),
            would_create: false,
            would_reuse: false,
            would_conflict: false,
            materialization_status: PROMPT_PACK_MATERIALIZATION_STATUS_NOT_EVALUATED.to_owned(),
        };
        preview.task_spec_hash = task_spec_hash(&preview);
        tasks.push(preview);
    }

    detect_dependency_cycle(&dependencies_by_task)?;

    let dependency_spec_hash = dependency_spec_hash(&dependencies_by_task);
    let run_settings_hash = run_settings_hash(&run_settings);
    let pack = AgentQueuePromptPackMetadataPreview {
        version: input.version,
        pack_id: input.pack_id,
        title: input.title,
        description: input.description,
        defaults,
        constraints,
    };
    let pack_spec_hash = pack_spec_hash(&pack, &tasks, &dependency_spec_hash, &run_settings_hash);
    let full_preview_hash = full_preview_hash(&pack_spec_hash);

    Ok(AgentQueuePromptPackPreview {
        workspace_id,
        pack,
        run_settings,
        task_count: tasks.len(),
        dependency_count,
        tasks,
        pack_spec_hash,
        run_settings_hash,
        dependency_spec_hash,
        full_preview_hash,
        blockers: Vec::new(),
        warnings: Vec::new(),
        would_start_workers: false,
        would_create_run_links: false,
        would_mutate_queue: false,
        would_create: false,
        would_reuse: false,
        would_conflict: false,
        materialization_status: PROMPT_PACK_MATERIALIZATION_STATUS_NOT_EVALUATED.to_owned(),
    })
}

fn normalize_defaults(
    input: Option<PromptPackDefaultsInput>,
) -> Result<AgentQueuePromptPackDefaultsPreview, AgentQueuePromptPackPreviewDiagnostic> {
    let status = input
        .as_ref()
        .and_then(|defaults| defaults.status.as_deref())
        .unwrap_or(AGENT_QUEUE_TASK_STATUS_DRAFT);
    if status != AGENT_QUEUE_TASK_STATUS_DRAFT {
        return Err(diagnostic(
            "unsupported_default_status",
            "Prompt pack defaults.status must be draft for preview MVP.",
            Some("$.defaults.status"),
        ));
    }

    let priority = input
        .as_ref()
        .and_then(|defaults| defaults.priority)
        .unwrap_or(DEFAULT_PRIORITY);
    validate_priority(priority, "$.defaults.priority")?;

    Ok(AgentQueuePromptPackDefaultsPreview {
        status: status.to_owned(),
        priority,
    })
}

fn normalize_constraints(
    input: Option<PromptPackConstraintsInput>,
) -> Result<AgentQueuePromptPackConstraintsPreview, AgentQueuePromptPackPreviewDiagnostic> {
    if input
        .as_ref()
        .and_then(|constraints| constraints.no_auto_run)
        == Some(false)
    {
        return Err(diagnostic(
            "auto_run_not_allowed",
            "Prompt pack constraints.noAutoRun must be true when present.",
            Some("$.constraints.noAutoRun"),
        ));
    }

    Ok(AgentQueuePromptPackConstraintsPreview { no_auto_run: true })
}

fn normalize_run_settings(
    input: Option<PromptPackRunSettingsInput>,
) -> Result<AgentQueuePromptPackRunSettingsPreview, AgentQueuePromptPackPreviewDiagnostic> {
    let execution_policy = input
        .as_ref()
        .and_then(|settings| normalize_optional_value(settings.execution_policy.as_deref()))
        .unwrap_or_else(|| AGENT_QUEUE_TASK_EXECUTION_POLICY_MANUAL.to_owned());
    if execution_policy != AGENT_QUEUE_TASK_EXECUTION_POLICY_MANUAL {
        return Err(diagnostic(
            "unsupported_execution_policy",
            "Prompt pack runSettings.executionPolicy must be manual.",
            Some("$.runSettings.executionPolicy"),
        ));
    }

    let execution_target = match input
        .as_ref()
        .and_then(|settings| settings.execution_target.as_ref())
    {
        Some(target) => Some(normalize_execution_target(target)?),
        None => None,
    };

    let sandbox = input
        .as_ref()
        .and_then(|settings| normalize_optional_value(settings.sandbox.as_deref()));
    if let Some(sandbox) = sandbox.as_deref() {
        if !matches!(sandbox, "read_only" | "workspace_write") {
            return Err(diagnostic(
                "unsupported_sandbox",
                "Prompt pack runSettings.sandbox must be read_only or workspace_write.",
                Some("$.runSettings.sandbox"),
            ));
        }
    }

    let approval_policy = input
        .as_ref()
        .and_then(|settings| normalize_optional_value(settings.approval_policy.as_deref()));
    if let Some(approval_policy) = approval_policy.as_deref() {
        if approval_policy != "never" {
            return Err(diagnostic(
                "unsupported_approval_policy",
                "Prompt pack runSettings.approvalPolicy must be never for preview MVP.",
                Some("$.runSettings.approvalPolicy"),
            ));
        }
    }

    Ok(AgentQueuePromptPackRunSettingsPreview {
        execution_target,
        execution_policy,
        sandbox,
        approval_policy,
    })
}

fn normalize_execution_target(
    input: &PromptPackExecutionTargetInput,
) -> Result<AgentQueuePromptPackExecutionTargetPreview, AgentQueuePromptPackPreviewDiagnostic> {
    let kind = normalize_optional_value(input.kind.as_deref()).ok_or_else(|| {
        diagnostic(
            "missing_execution_target_kind",
            "Prompt pack runSettings.executionTarget.kind is required when executionTarget is present.",
            Some("$.runSettings.executionTarget.kind"),
        )
    })?;
    let provider_id = normalize_optional_value(input.provider_id.as_deref()).ok_or_else(|| {
        diagnostic(
            "missing_execution_target_provider",
            "Prompt pack runSettings.executionTarget.providerId is required when executionTarget is present.",
            Some("$.runSettings.executionTarget.providerId"),
        )
    })?;

    if kind != "queue_local" || provider_id != "codex" {
        return Err(diagnostic(
            "unsupported_execution_target",
            "Prompt pack executionTarget must be { kind: \"queue_local\", providerId: \"codex\" }.",
            Some("$.runSettings.executionTarget"),
        ));
    }

    Ok(AgentQueuePromptPackExecutionTargetPreview { kind, provider_id })
}

fn normalize_tags(
    tags: Vec<String>,
    task_index: usize,
) -> Result<Vec<String>, AgentQueuePromptPackPreviewDiagnostic> {
    if tags.len() > MAX_TAGS {
        return Err(diagnostic(
            "too_many_tags",
            format!("Prompt pack task tags exceed the limit of {MAX_TAGS}."),
            Some(format!("$.tasks[{task_index}].tags")),
        ));
    }

    let mut normalized = BTreeSet::new();
    for (tag_index, tag) in tags.into_iter().enumerate() {
        let tag = tag.trim().to_ascii_lowercase();
        if tag.is_empty() {
            return Err(diagnostic(
                "missing_tag",
                "Prompt pack task tags must not be empty.",
                Some(format!("$.tasks[{task_index}].tags[{tag_index}]")),
            ));
        }
        if tag.chars().count() > MAX_TAG_CHARS {
            return Err(diagnostic(
                "oversized_tag",
                format!("Prompt pack task tags must be {MAX_TAG_CHARS} characters or fewer."),
                Some(format!("$.tasks[{task_index}].tags[{tag_index}]")),
            ));
        }
        if !normalized.insert(tag.clone()) {
            return Err(diagnostic(
                "duplicate_tag",
                format!("Prompt pack task contains duplicate tag \"{tag}\" after normalization."),
                Some(format!("$.tasks[{task_index}].tags[{tag_index}]")),
            ));
        }
    }

    Ok(normalized.into_iter().collect())
}

fn normalize_dependencies(
    dependencies: Vec<String>,
    task_id: &str,
    known_task_ids: &BTreeSet<String>,
    task_index: usize,
) -> Result<Vec<String>, AgentQueuePromptPackPreviewDiagnostic> {
    let mut normalized = BTreeSet::new();
    for (dependency_index, dependency_id) in dependencies.into_iter().enumerate() {
        validate_slug(
            &dependency_id,
            "dependency id",
            &format!("$.tasks[{task_index}].dependsOn[{dependency_index}]"),
            MAX_TASK_ID_CHARS,
        )?;
        if dependency_id == task_id {
            return Err(diagnostic(
                "self_dependency",
                format!("Prompt pack task \"{task_id}\" must not depend on itself."),
                Some(format!(
                    "$.tasks[{task_index}].dependsOn[{dependency_index}]"
                )),
            ));
        }
        if !known_task_ids.contains(&dependency_id) {
            return Err(diagnostic(
                "unknown_dependency",
                format!(
                    "Prompt pack task \"{task_id}\" depends on unknown task \"{dependency_id}\"."
                ),
                Some(format!(
                    "$.tasks[{task_index}].dependsOn[{dependency_index}]"
                )),
            ));
        }
        if !normalized.insert(dependency_id.clone()) {
            return Err(diagnostic(
                "duplicate_dependency",
                format!(
                    "Prompt pack task \"{task_id}\" contains duplicate dependency \"{dependency_id}\"."
                ),
                Some(format!("$.tasks[{task_index}].dependsOn[{dependency_index}]")),
            ));
        }
    }

    Ok(normalized.into_iter().collect())
}

fn normalize_safety(
    safety: Option<PromptPackSafetyInput>,
    task_index: usize,
) -> Result<Option<AgentQueuePromptPackSafetyPreview>, AgentQueuePromptPackPreviewDiagnostic> {
    let Some(safety) = safety else {
        return Ok(None);
    };

    if let Some(notes) = safety.notes.as_deref() {
        validate_optional_bounded_string(
            notes,
            "safety.notes",
            &format!("$.tasks[{task_index}].safety.notes"),
            MAX_SAFETY_NOTES_CHARS,
        )?;
    }

    Ok(Some(AgentQueuePromptPackSafetyPreview {
        notes: safety.notes,
        sensitive_text_warning: safety.sensitive_text_warning,
    }))
}

fn validate_prompt(prompt: &str, path: &str) -> Result<(), AgentQueuePromptPackPreviewDiagnostic> {
    if prompt.is_empty() {
        return Err(diagnostic(
            "missing_prompt",
            "Prompt pack task prompt is required.",
            Some(path),
        ));
    }
    if prompt.chars().count() > MAX_PROMPT_CHARS {
        return Err(diagnostic(
            "oversized_prompt",
            format!("Prompt pack task prompt must be {MAX_PROMPT_CHARS} characters or fewer."),
            Some(path),
        ));
    }

    Ok(())
}

fn validate_required_bounded_string(
    value: &str,
    label: &str,
    path: &str,
    max_chars: usize,
) -> Result<(), AgentQueuePromptPackPreviewDiagnostic> {
    if value.trim().is_empty() {
        return Err(diagnostic(
            format!("missing_{}", label.replace(' ', "_")),
            format!("Prompt pack {label} is required."),
            Some(path),
        ));
    }
    if value.chars().count() > max_chars {
        return Err(diagnostic(
            format!("oversized_{}", label.replace(' ', "_")),
            format!("Prompt pack {label} must be {max_chars} characters or fewer."),
            Some(path),
        ));
    }

    Ok(())
}

fn required_text<'a>(value: &'a str, label: &str) -> Result<&'a str, WorkspaceServiceError> {
    let value = value.trim();
    if value.is_empty() {
        return Err(WorkspaceServiceError::InvalidInput(format!(
            "{label} is required"
        )));
    }
    Ok(value)
}

fn non_empty_text(value: &str) -> Option<&str> {
    let value = value.trim();
    (!value.is_empty()).then_some(value)
}

fn normalize_prompt_pack_workspace_relative_path(
    value: &str,
) -> Result<String, WorkspaceServiceError> {
    let value = required_text(value, "workspace-relative prompt-pack path")?;
    let path = Path::new(value);
    if path.is_absolute() {
        return Err(WorkspaceServiceError::InvalidInput(
            "prompt-pack path must be workspace-relative".to_owned(),
        ));
    }

    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Normal(part) => normalized.push(part),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(WorkspaceServiceError::InvalidInput(
                    "prompt-pack path must stay inside the workspace root".to_owned(),
                ));
            }
        }
    }
    if normalized.as_os_str().is_empty() {
        return Err(WorkspaceServiceError::InvalidInput(
            "workspace-relative prompt-pack path is required".to_owned(),
        ));
    }
    if normalized
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.eq_ignore_ascii_case("json"))
        != Some(true)
    {
        return Err(WorkspaceServiceError::InvalidInput(
            "prompt-pack workspace file must use a .json extension".to_owned(),
        ));
    }

    normalized
        .to_str()
        .map(|path| path.replace('\\', "/"))
        .ok_or_else(|| {
            WorkspaceServiceError::InvalidInput(
                "prompt-pack workspace path must be valid UTF-8".to_owned(),
            )
        })
}

fn validate_optional_bounded_string(
    value: &str,
    label: &str,
    path: &str,
    max_chars: usize,
) -> Result<(), AgentQueuePromptPackPreviewDiagnostic> {
    if value.chars().count() > max_chars {
        return Err(diagnostic(
            format!("oversized_{}", label.replace('.', "_")),
            format!("Prompt pack {label} must be {max_chars} characters or fewer."),
            Some(path),
        ));
    }

    Ok(())
}

fn validate_slug(
    value: &str,
    label: &str,
    path: &str,
    max_chars: usize,
) -> Result<(), AgentQueuePromptPackPreviewDiagnostic> {
    if value.is_empty() {
        return Err(diagnostic(
            format!("missing_{}", label.replace(' ', "_")),
            format!("Prompt pack {label} is required."),
            Some(path),
        ));
    }
    if value.chars().count() > max_chars {
        return Err(diagnostic(
            format!("oversized_{}", label.replace(' ', "_")),
            format!("Prompt pack {label} must be {max_chars} characters or fewer."),
            Some(path),
        ));
    }
    if !is_slug_like(value) {
        return Err(diagnostic(
            format!("malformed_{}", label.replace(' ', "_")),
            format!("Prompt pack {label} must be lower-case slug-like ASCII."),
            Some(path),
        ));
    }

    Ok(())
}

fn is_slug_like(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.is_empty() {
        return false;
    }
    if !bytes[0].is_ascii_lowercase() && !bytes[0].is_ascii_digit() {
        return false;
    }
    if !bytes[bytes.len() - 1].is_ascii_lowercase() && !bytes[bytes.len() - 1].is_ascii_digit() {
        return false;
    }

    bytes
        .iter()
        .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || *byte == b'-')
}

fn validate_priority(
    priority: i64,
    path: &str,
) -> Result<(), AgentQueuePromptPackPreviewDiagnostic> {
    if !(MIN_PRIORITY..=MAX_PRIORITY).contains(&priority) {
        return Err(diagnostic(
            "invalid_priority",
            format!("Prompt pack priority must be between {MIN_PRIORITY} and {MAX_PRIORITY}."),
            Some(path),
        ));
    }

    Ok(())
}

fn detect_dependency_cycle(
    dependencies_by_task: &BTreeMap<String, Vec<String>>,
) -> Result<(), AgentQueuePromptPackPreviewDiagnostic> {
    let mut states = BTreeMap::<String, VisitState>::new();
    for task_id in dependencies_by_task.keys() {
        if visit_dependency_node(task_id, dependencies_by_task, &mut states)? {
            return Err(diagnostic(
                "dependency_cycle",
                "Prompt pack dependencies must not contain a cycle.",
                Some("$.tasks"),
            ));
        }
    }

    Ok(())
}

fn visit_dependency_node(
    task_id: &str,
    dependencies_by_task: &BTreeMap<String, Vec<String>>,
    states: &mut BTreeMap<String, VisitState>,
) -> Result<bool, AgentQueuePromptPackPreviewDiagnostic> {
    match states.get(task_id).copied() {
        Some(VisitState::Visiting) => return Ok(true),
        Some(VisitState::Visited) => return Ok(false),
        None => {}
    }

    states.insert(task_id.to_owned(), VisitState::Visiting);
    if let Some(dependencies) = dependencies_by_task.get(task_id) {
        for dependency_id in dependencies {
            if visit_dependency_node(dependency_id, dependencies_by_task, states)? {
                return Ok(true);
            }
        }
    }
    states.insert(task_id.to_owned(), VisitState::Visited);
    Ok(false)
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum VisitState {
    Visiting,
    Visited,
}

fn task_spec_hash(task: &AgentQueuePromptPackTaskPreview) -> String {
    hash_value(
        "prompt_pack_task_spec",
        &json!({
            "schema": "hobit.queue.promptPack.task.v1",
            "id": task.id,
            "title": task.title,
            "prompt": task.prompt,
            "tags": task.tags,
            "priority": task.priority,
            "status": task.status,
            "expectedOutput": task.expected_output,
            "safety": task.safety.as_ref().map(safety_hash_value),
        }),
    )
}

fn dependency_spec_hash(dependencies_by_task: &BTreeMap<String, Vec<String>>) -> String {
    let edges = dependencies_by_task
        .iter()
        .flat_map(|(task_id, dependencies)| {
            let task_id = task_id.clone();
            dependencies.iter().map(move |dependency_id| {
                json!({
                    "taskId": task_id,
                    "dependsOn": dependency_id,
                })
            })
        })
        .collect::<Vec<_>>();

    hash_value(
        "prompt_pack_dependency_spec",
        &json!({
            "schema": "hobit.queue.promptPack.dependencies.v1",
            "edges": edges,
        }),
    )
}

fn run_settings_hash(settings: &AgentQueuePromptPackRunSettingsPreview) -> String {
    hash_value(
        "prompt_pack_run_settings",
        &json!({
            "schema": "hobit.queue.promptPack.runSettings.v1",
            "executionTarget": settings.execution_target.as_ref().map(execution_target_hash_value),
            "executionPolicy": settings.execution_policy,
            "sandbox": settings.sandbox,
            "approvalPolicy": settings.approval_policy,
        }),
    )
}

fn pack_spec_hash(
    pack: &AgentQueuePromptPackMetadataPreview,
    tasks: &[AgentQueuePromptPackTaskPreview],
    dependency_spec_hash: &str,
    run_settings_hash: &str,
) -> String {
    let task_spec_hashes = tasks
        .iter()
        .map(|task| (task.id.clone(), task.task_spec_hash.clone()))
        .collect::<BTreeMap<_, _>>()
        .into_iter()
        .map(|(task_id, task_spec_hash)| {
            json!({
                "taskId": task_id,
                "taskSpecHash": task_spec_hash,
            })
        })
        .collect::<Vec<_>>();

    hash_value(
        "prompt_pack_spec",
        &json!({
            "schema": "hobit.queue.promptPack.pack.v1",
            "version": pack.version,
            "packId": pack.pack_id,
            "title": pack.title,
            "description": pack.description,
            "defaults": {
                "status": pack.defaults.status,
                "priority": pack.defaults.priority,
            },
            "constraints": {
                "noAutoRun": pack.constraints.no_auto_run,
            },
            "taskSpecHashes": task_spec_hashes,
            "dependencySpecHash": dependency_spec_hash,
            "runSettingsHash": run_settings_hash,
        }),
    )
}

fn full_preview_hash(pack_spec_hash: &str) -> String {
    hash_value(
        "prompt_pack_preview",
        &json!({
            "schema": "hobit.queue.promptPack.preview.v1",
            "packSpecHash": pack_spec_hash,
            "wouldStartWorkers": false,
            "wouldCreateRunLinks": false,
            "wouldMutateQueue": false,
            "materializationStatus": PROMPT_PACK_MATERIALIZATION_STATUS_NOT_EVALUATED,
        }),
    )
}

fn hash_value(prefix: &str, value: &Value) -> String {
    let canonical = canonical_json_string(value);
    stable_fnv1a64_hash(prefix, &canonical)
}

fn safety_hash_value(safety: &AgentQueuePromptPackSafetyPreview) -> Value {
    json!({
        "notes": safety.notes,
        "sensitiveTextWarning": safety.sensitive_text_warning,
    })
}

fn execution_target_hash_value(target: &AgentQueuePromptPackExecutionTargetPreview) -> Value {
    json!({
        "kind": target.kind,
        "providerId": target.provider_id,
    })
}

fn validate_json_shape(value: &Value) -> Option<AgentQueuePromptPackPreviewDiagnostic> {
    let object = value.as_object()?;
    if let Some(error) = validate_object_fields(
        object,
        "$",
        &[
            "version",
            "packId",
            "title",
            "description",
            "defaults",
            "runSettings",
            "constraints",
            "tasks",
        ],
    ) {
        return Some(error);
    }

    if let Some(defaults) = object.get("defaults") {
        if let Some(error) =
            validate_nested_object_fields(defaults, "$.defaults", &["status", "priority"])
        {
            return Some(error);
        }
    }
    if let Some(run_settings) = object.get("runSettings") {
        if let Some(error) = validate_nested_object_fields(
            run_settings,
            "$.runSettings",
            &[
                "executionTarget",
                "executionPolicy",
                "sandbox",
                "approvalPolicy",
            ],
        ) {
            return Some(error);
        }
        if let Some(target) = run_settings
            .as_object()
            .and_then(|settings| settings.get("executionTarget"))
        {
            if let Some(error) = validate_nested_object_fields(
                target,
                "$.runSettings.executionTarget",
                &["kind", "providerId"],
            ) {
                return Some(error);
            }
        }
    }
    if let Some(constraints) = object.get("constraints") {
        if let Some(error) =
            validate_nested_object_fields(constraints, "$.constraints", &["noAutoRun"])
        {
            return Some(error);
        }
    }
    if let Some(tasks) = object.get("tasks").and_then(Value::as_array) {
        for (index, task) in tasks.iter().enumerate() {
            let path = format!("$.tasks[{index}]");
            if let Some(error) = validate_nested_object_fields(
                task,
                &path,
                &[
                    "id",
                    "title",
                    "prompt",
                    "dependsOn",
                    "tags",
                    "priority",
                    "expectedOutput",
                    "safety",
                ],
            ) {
                return Some(error);
            }
            if let Some(safety) = task.as_object().and_then(|object| object.get("safety")) {
                if let Some(error) = validate_nested_object_fields(
                    safety,
                    &format!("{path}.safety"),
                    &["notes", "sensitiveTextWarning"],
                ) {
                    return Some(error);
                }
            }
        }
    }

    None
}

fn validate_nested_object_fields(
    value: &Value,
    path: &str,
    allowed_fields: &[&str],
) -> Option<AgentQueuePromptPackPreviewDiagnostic> {
    let object = value.as_object()?;
    validate_object_fields(object, path, allowed_fields)
}

fn validate_object_fields(
    object: &serde_json::Map<String, Value>,
    path: &str,
    allowed_fields: &[&str],
) -> Option<AgentQueuePromptPackPreviewDiagnostic> {
    for key in object.keys() {
        if !allowed_fields.iter().any(|allowed| allowed == key) {
            return Some(diagnostic(
                "unsupported_field",
                format!("Prompt pack field \"{key}\" is not supported."),
                Some(join_object_path(path, key)),
            ));
        }
    }

    None
}

fn validate_required_keys(value: &Value) -> Option<AgentQueuePromptPackPreviewDiagnostic> {
    let object = value.as_object()?;
    for (key, code, message) in [
        (
            "version",
            "missing_version",
            "Prompt pack version is required.",
        ),
        (
            "packId",
            "missing_pack_id",
            "Prompt pack packId is required.",
        ),
        ("title", "missing_title", "Prompt pack title is required."),
        ("tasks", "missing_tasks", "Prompt pack tasks are required."),
    ] {
        if !object.contains_key(key) {
            return Some(diagnostic(code, message, Some(join_object_path("$", key))));
        }
    }

    if let Some(tasks) = object.get("tasks").and_then(Value::as_array) {
        for (index, task) in tasks.iter().enumerate() {
            let Some(task_object) = task.as_object() else {
                continue;
            };
            for (key, code, message) in [
                ("id", "missing_task_id", "Prompt pack task id is required."),
                (
                    "title",
                    "missing_task_title",
                    "Prompt pack task title is required.",
                ),
                (
                    "prompt",
                    "missing_prompt",
                    "Prompt pack task prompt is required.",
                ),
            ] {
                if !task_object.contains_key(key) {
                    return Some(diagnostic(
                        code,
                        message,
                        Some(format!("$.tasks[{index}].{key}")),
                    ));
                }
            }
        }
    }

    None
}

fn find_forbidden_key(value: &Value, path: &str) -> Option<AgentQueuePromptPackPreviewDiagnostic> {
    match value {
        Value::Object(object) => {
            for (key, child) in object {
                let child_path = join_object_path(path, key);
                if key == "confirmationToken" {
                    return Some(diagnostic(
                        "confirmation_token_rejected",
                        "Prompt pack JSON must not contain a confirmationToken object key.",
                        Some(child_path),
                    ));
                }
                if matches!(
                    key.as_str(),
                    "workspaceId" | "workspaceRoot" | "executionWorkspace"
                ) {
                    return Some(diagnostic(
                        "workspace_scope_rejected",
                        "Prompt pack JSON must not define workspace scope or execution workspace fields.",
                        Some(child_path),
                    ));
                }
                if let Some(error) = find_forbidden_key(child, &child_path) {
                    return Some(error);
                }
            }
            None
        }
        Value::Array(values) => values
            .iter()
            .enumerate()
            .find_map(|(index, child)| find_forbidden_key(child, &format!("{path}[{index}]"))),
        _ => None,
    }
}

fn normalize_optional_value(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}

fn join_object_path(parent: &str, key: &str) -> String {
    if parent == "$" {
        format!("$.{key}")
    } else {
        format!("{parent}.{key}")
    }
}

fn invalid_result(
    error: AgentQueuePromptPackPreviewDiagnostic,
) -> AgentQueuePromptPackPreviewResult {
    AgentQueuePromptPackPreviewResult {
        status: PROMPT_PACK_PREVIEW_STATUS_INVALID.to_owned(),
        preview: None,
        errors: vec![error],
        source: None,
    }
}

fn diagnostic(
    code: impl Into<String>,
    message: impl Into<String>,
    path: Option<impl Into<String>>,
) -> AgentQueuePromptPackPreviewDiagnostic {
    AgentQueuePromptPackPreviewDiagnostic {
        code: code.into(),
        message: message.into(),
        path: path.map(Into::into),
    }
}
