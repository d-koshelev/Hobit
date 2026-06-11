use std::collections::{HashMap, HashSet};

use hobit_storage_sqlite::{AgentQueueTaskRow, SqliteStore, StorageError};

use crate::WorkspaceServiceError;

use super::validation::required_input;

pub(super) fn normalize_optional_dependency_ids(
    dependency_ids: Option<Vec<String>>,
) -> Result<Option<Vec<String>>, WorkspaceServiceError> {
    dependency_ids.map(normalize_dependency_ids).transpose()
}

fn normalize_dependency_ids(
    dependency_ids: Vec<String>,
) -> Result<Vec<String>, WorkspaceServiceError> {
    let mut seen = HashSet::new();
    let mut normalized = Vec::new();

    for dependency_id in dependency_ids {
        let dependency_id = required_input(&dependency_id, "queue task dependency id")?.to_owned();
        if !seen.insert(dependency_id.clone()) {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "duplicate queue task dependency id: {dependency_id}"
            )));
        }
        normalized.push(dependency_id);
    }

    Ok(normalized)
}

pub(super) fn dependencies_json(dependency_ids: &[String]) -> Result<String, StorageError> {
    serde_json::to_string(dependency_ids).map_err(|error| {
        storage_invalid_input(format!(
            "queue task dependencies could not be serialized: {error}"
        ))
    })
}

pub(super) fn validate_create_dependencies(
    store: &SqliteStore,
    workspace_id: &str,
    dependency_ids: &[String],
) -> Result<(), StorageError> {
    for dependency_id in dependency_ids {
        if store
            .get_agent_queue_task(workspace_id, dependency_id)?
            .is_none()
        {
            return Err(storage_invalid_input(format!(
                "queue task dependency not found in workspace: {dependency_id}"
            )));
        }
    }

    Ok(())
}

pub(super) fn validate_dependency_update(
    store: &SqliteStore,
    workspace_id: &str,
    queue_item_id: &str,
    dependency_ids: Option<&[String]>,
) -> Result<(), StorageError> {
    let Some(dependency_ids) = dependency_ids else {
        return Ok(());
    };

    let tasks = store.list_agent_queue_tasks(workspace_id)?;
    let mut graph: HashMap<String, Vec<String>> = HashMap::new();

    for task in tasks {
        graph.insert(task.queue_item_id.clone(), row_dependency_ids(&task));
    }

    if !graph.contains_key(queue_item_id) {
        return Err(storage_invalid_input(format!(
            "queue task not found: {queue_item_id}"
        )));
    }

    for dependency_id in dependency_ids {
        if dependency_id == queue_item_id {
            return Err(storage_invalid_input(
                "queue task cannot depend on itself".to_owned(),
            ));
        }
        if !graph.contains_key(dependency_id) {
            return Err(storage_invalid_input(format!(
                "queue task dependency not found in workspace: {dependency_id}"
            )));
        }
    }

    graph.insert(queue_item_id.to_owned(), dependency_ids.to_vec());

    for dependency_id in dependency_ids {
        if dependency_path_reaches(&graph, dependency_id, queue_item_id, &mut HashSet::new()) {
            return Err(storage_invalid_input(format!(
                "queue task dependency would create a cycle: {queue_item_id} -> {dependency_id}"
            )));
        }
    }

    Ok(())
}

fn row_dependency_ids(row: &AgentQueueTaskRow) -> Vec<String> {
    serde_json::from_str::<Vec<String>>(&row.depends_on).unwrap_or_default()
}

fn dependency_path_reaches(
    graph: &HashMap<String, Vec<String>>,
    current_id: &str,
    target_id: &str,
    visited: &mut HashSet<String>,
) -> bool {
    if current_id == target_id {
        return true;
    }
    if !visited.insert(current_id.to_owned()) {
        return false;
    }

    graph
        .get(current_id)
        .into_iter()
        .flatten()
        .any(|dependency_id| dependency_path_reaches(graph, dependency_id, target_id, visited))
}

fn storage_invalid_input(message: String) -> StorageError {
    StorageError::InvalidParameterName(message)
}
