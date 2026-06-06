use hobit_storage_sqlite::AgentQueueTaskRow;

use super::{
    bounded_text, estimate_tokens, visible_value, QueueTaskContextSnapshot,
    QueueTaskContextWarning, CONTEXT_CHAR_BUDGET,
};

pub(super) fn prompt_context_section(snapshots: &[QueueTaskContextSnapshot]) -> String {
    let skills = snapshots
        .iter()
        .filter(|snapshot| snapshot.kind == "skill")
        .collect::<Vec<_>>();
    let knowledge = snapshots
        .iter()
        .filter(|snapshot| snapshot.kind == "knowledge_document")
        .collect::<Vec<_>>();
    let mut sections = vec![
        "Knowledge / Skills context".to_owned(),
        "Only this visible, bounded Queue-owned task context is included.".to_owned(),
        "This context is saved on the Queue task until removed.".to_owned(),
    ];
    if !skills.is_empty() {
        sections.push("Visible Skill Instructions".to_owned());
        sections.extend(skills.into_iter().map(snapshot_prompt_block));
    }
    if !knowledge.is_empty() {
        sections.push("Visible Knowledge Document Excerpts".to_owned());
        sections.extend(knowledge.into_iter().map(snapshot_prompt_block));
    }
    sections.join("\n\n")
}

pub(super) fn prompt_evidence_section(
    task: &AgentQueueTaskRow,
    snapshots: &[QueueTaskContextSnapshot],
    warnings: &[QueueTaskContextWarning],
) -> String {
    let warning_ids = warnings
        .iter()
        .map(|warning| warning.id.as_str())
        .collect::<Vec<_>>();
    let knowledge_refs = refs_for_kind(snapshots, "knowledge_document");
    let skill_refs = refs_for_kind(snapshots, "skill");
    let scopes = unique_snapshot_values(snapshots, |snapshot| snapshot.scope.as_str());
    let sources = unique_snapshot_values(snapshots, |snapshot| snapshot.source.as_str());

    [
        "Context used".to_owned(),
        format!("Queue task id: {}", task.queue_item_id),
        "Context storage: durable Queue task context.".to_owned(),
        "Included in this run prompt: yes.".to_owned(),
        format!(
            "Snapshot ids used: {}",
            snapshots
                .iter()
                .map(|snapshot| snapshot.id.as_str())
                .collect::<Vec<_>>()
                .join(", ")
        ),
        format!("Knowledge refs used: {}", none_or_join(knowledge_refs)),
        format!("Skill refs used: {}", none_or_join(skill_refs)),
        format!(
            "Materialized at: {}",
            snapshots
                .first()
                .map(|snapshot| snapshot.materialized_at.as_str())
                .unwrap_or("Not materialized")
        ),
        format!(
            "Context token estimate: {}",
            snapshots
                .iter()
                .map(|snapshot| snapshot.token_estimate)
                .sum::<i64>()
        ),
        format!("Context warning ids: {}", none_or_join(warning_ids)),
        format!("Source scopes: {}", scopes.join(", ")),
        format!("Source labels: {}", sources.join(", ")),
    ]
    .join("\n")
}

pub(super) fn capped_snapshots_for_prompt(
    snapshots: &[QueueTaskContextSnapshot],
) -> Vec<QueueTaskContextSnapshot> {
    let mut selected = Vec::new();
    let mut used_chars = 0_usize;
    for snapshot in snapshots {
        if used_chars >= CONTEXT_CHAR_BUDGET {
            break;
        }
        let remaining = CONTEXT_CHAR_BUDGET - used_chars;
        let bounded = bounded_text(&snapshot.content, remaining);
        used_chars += bounded.text.len();
        selected.push(QueueTaskContextSnapshot {
            capped: snapshot.capped || bounded.capped,
            content: bounded.text.clone(),
            token_estimate: estimate_tokens(&bounded.text),
            ..snapshot.clone()
        });
    }
    selected
}

fn snapshot_prompt_block(snapshot: &QueueTaskContextSnapshot) -> String {
    [
        Some(format!("[{}] {}", snapshot.kind, snapshot.title)),
        Some(format!("Ref: {}", snapshot.source_ref_id)),
        Some(format!("Scope: {}", snapshot.scope)),
        Some(format!("Source: {}", snapshot.source)),
        Some(format!(
            "Version: {}",
            visible_value(&snapshot.version, "Unknown")
        )),
        Some(format!("Snapshot: {}", snapshot.id)),
        Some(snapshot.content.clone()),
        snapshot.capped.then(|| "[Capped excerpt]".to_owned()),
    ]
    .into_iter()
    .flatten()
    .collect::<Vec<_>>()
    .join("\n")
}

fn refs_for_kind(snapshots: &[QueueTaskContextSnapshot], kind: &str) -> Vec<String> {
    snapshots
        .iter()
        .filter(|snapshot| snapshot.kind == kind)
        .map(|snapshot| {
            format!(
                "{}@{}",
                snapshot.source_ref_id,
                visible_value(&snapshot.version, "unknown")
            )
        })
        .collect()
}

fn unique_snapshot_values<'a>(
    snapshots: &'a [QueueTaskContextSnapshot],
    value: impl Fn(&'a QueueTaskContextSnapshot) -> &'a str,
) -> Vec<String> {
    let mut values = Vec::new();
    for snapshot in snapshots {
        let value = value(snapshot);
        if !values.iter().any(|existing| existing == value) {
            values.push(value.to_owned());
        }
    }
    values
}

fn none_or_join(values: Vec<impl AsRef<str>>) -> String {
    if values.is_empty() {
        "None".to_owned()
    } else {
        values
            .iter()
            .map(AsRef::as_ref)
            .collect::<Vec<_>>()
            .join(", ")
    }
}
