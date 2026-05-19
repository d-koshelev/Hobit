use super::{
    CoordinatorProviderProposalDraftContext, CoordinatorProviderRequest,
    CoordinatorProviderVisibleInput,
};

const QUEUE_TYPE_ID: &str = "create-agent-queue-task";
const NOTE_TYPE_ID: &str = "create-note";
const JDBC_TYPE_ID: &str = "prepare-jdbc-query-suggestion";
const QUEUE_TARGET_WIDGET: &str = "Agent Queue";
const NOTE_TARGET_WIDGET: &str = "Notes";
const JDBC_TARGET_WIDGET: &str = "Database / JDBC";
const QUEUE_TARGET_CAPABILITY: &str = "create Queue task";
const NOTE_TARGET_CAPABILITY: &str = "create Note";
const JDBC_TARGET_CAPABILITY: &str = "prepare query suggestion";
const MAX_DRAFTS: usize = 3;
const MAX_FIELD_CHARS: usize = 2_000;
const MAX_TITLE_CHARS: usize = 72;
const SQL_PLACEHOLDER: &str =
    "-- Edit this visible SQL suggestion before use.\n-- Coordinator did not inspect connectors, schemas, or database data.";

pub(super) struct ValidatedProviderDrafts {
    pub accepted: Vec<CoordinatorProviderProposalDraftContext>,
    pub rejected_count: usize,
}

pub(super) fn mock_provider_proposal_drafts(
    request: &CoordinatorProviderRequest,
) -> Vec<CoordinatorProviderProposalDraftContext> {
    let message = normalize_whitespace(&request.operator_message);
    let mut drafts = Vec::new();

    if matches_any(
        &message,
        &[
            "create queue task",
            "create agent queue task",
            "add queue task",
            "add agent queue task",
            "make task",
        ],
    ) {
        drafts.push(queue_draft(&message, &request.request_id));
    }

    if matches_any(
        &message,
        &["create note", "create a note", "save note", "write note"],
    ) {
        drafts.push(note_draft(&message, &request.request_id));
    }

    if matches_any(&message, &["prepare sql", "write sql", "suggest query"]) {
        drafts.push(jdbc_draft(
            &request.operator_message,
            &message,
            &request.request_id,
        ));
    }

    drafts
}

pub(super) fn validate_provider_proposal_drafts(
    drafts: Vec<CoordinatorProviderProposalDraftContext>,
) -> ValidatedProviderDrafts {
    let mut accepted = Vec::new();
    let mut rejected_count = 0;

    for draft in drafts.into_iter().take(MAX_DRAFTS) {
        match validate_provider_draft(draft) {
            Some(draft) => accepted.push(draft),
            None => rejected_count += 1,
        }
    }

    ValidatedProviderDrafts {
        accepted,
        rejected_count,
    }
}

fn queue_draft(message: &str, request_id: &str) -> CoordinatorProviderProposalDraftContext {
    let title = labeled_value(message, &["title", "task title"])
        .unwrap_or_else(|| derived_title(message, "Coordinator queue task"));
    let prompt = labeled_value(message, &["prompt"]).unwrap_or_else(|| message.to_owned());
    let priority = labeled_value(message, &["priority"]).unwrap_or_else(|| "0".to_owned());

    CoordinatorProviderProposalDraftContext {
        id: format!("{request_id}-queue-draft"),
        type_id: QUEUE_TYPE_ID.to_owned(),
        title: title.clone(),
        target_widget: QUEUE_TARGET_WIDGET.to_owned(),
        target_capability: QUEUE_TARGET_CAPABILITY.to_owned(),
        intent: "Create a draft Agent Queue task from explicit operator text.".to_owned(),
        visible_inputs: vec![
            visible_input("Title", title),
            visible_input("Description", message.to_owned()),
            visible_input("Prompt", prompt),
            visible_input("Priority", priority),
        ],
        risk_notes: queue_risk_notes(),
        expected_result:
            "A reviewed draft Queue task can be created after approval and a separate create action; it will not run automatically."
                .to_owned(),
    }
}

fn note_draft(message: &str, request_id: &str) -> CoordinatorProviderProposalDraftContext {
    let title = labeled_value(message, &["title", "note title"])
        .unwrap_or_else(|| derived_title(message, "Coordinator note"));
    let body = labeled_value(message, &["body"]).unwrap_or_else(|| message.to_owned());

    CoordinatorProviderProposalDraftContext {
        id: format!("{request_id}-note-draft"),
        type_id: NOTE_TYPE_ID.to_owned(),
        title: title.clone(),
        target_widget: NOTE_TARGET_WIDGET.to_owned(),
        target_capability: NOTE_TARGET_CAPABILITY.to_owned(),
        intent: "Create a workspace-local Note from explicit operator text after review."
            .to_owned(),
        visible_inputs: vec![
            visible_input("Title", title),
            visible_input("Body", body),
            visible_input("Pinned", "false"),
        ],
        risk_notes: note_risk_notes(),
        expected_result:
            "A reviewed workspace-local Note can be created after approval and a separate Create Note action."
                .to_owned(),
    }
}

fn jdbc_draft(
    raw_message: &str,
    message: &str,
    request_id: &str,
) -> CoordinatorProviderProposalDraftContext {
    let sql = extract_read_only_sql(raw_message).unwrap_or_else(|| SQL_PLACEHOLDER.to_owned());
    let mut visible_inputs = vec![visible_input("Question", message.to_owned())];

    if let Some(connector_label) = labeled_value(message, &["connector", "connector label"]) {
        visible_inputs.push(visible_input("Connector label", connector_label));
    }

    visible_inputs.push(visible_input("Suggested SQL text", sql));

    CoordinatorProviderProposalDraftContext {
        id: format!("{request_id}-jdbc-draft"),
        type_id: JDBC_TYPE_ID.to_owned(),
        title: derived_title(message, "JDBC query suggestion"),
        target_widget: JDBC_TARGET_WIDGET.to_owned(),
        target_capability: JDBC_TARGET_CAPABILITY.to_owned(),
        intent: "Prepare non-executing SQL suggestion text from explicit operator input."
            .to_owned(),
        visible_inputs,
        risk_notes: jdbc_risk_notes(),
        expected_result:
            "A SQL suggestion can be reviewed and copied, but this preview cannot execute SQL."
                .to_owned(),
    }
}

fn validate_provider_draft(
    draft: CoordinatorProviderProposalDraftContext,
) -> Option<CoordinatorProviderProposalDraftContext> {
    if unsafe_target_or_capability(&draft) {
        return None;
    }

    match draft.type_id.as_str() {
        QUEUE_TYPE_ID => normalize_queue_draft(draft),
        NOTE_TYPE_ID => normalize_note_draft(draft),
        JDBC_TYPE_ID => normalize_jdbc_draft(draft),
        _ => None,
    }
}

fn normalize_queue_draft(
    draft: CoordinatorProviderProposalDraftContext,
) -> Option<CoordinatorProviderProposalDraftContext> {
    if !matches_target(&draft, QUEUE_TARGET_WIDGET, QUEUE_TARGET_CAPABILITY) {
        return None;
    }

    let title = required_input_value(&draft, "Title")?;
    let description = required_input_value(&draft, "Description")?;
    let prompt = required_input_value(&draft, "Prompt")?;
    let priority = clamp_priority(input_value(&draft, "Priority").unwrap_or_default());

    Some(CoordinatorProviderProposalDraftContext {
        id: draft.id,
        type_id: QUEUE_TYPE_ID.to_owned(),
        title: truncate_nonempty(draft.title, &title),
        target_widget: QUEUE_TARGET_WIDGET.to_owned(),
        target_capability: QUEUE_TARGET_CAPABILITY.to_owned(),
        intent: truncate_nonempty(draft.intent, "Create a draft Agent Queue task."),
        visible_inputs: vec![
            visible_input("Title", title),
            visible_input("Description", description),
            visible_input("Prompt", prompt),
            visible_input("Priority", priority.to_string()),
        ],
        risk_notes: risk_notes_or(draft.risk_notes, queue_risk_notes()),
        expected_result: truncate_nonempty(
            draft.expected_result,
            "A draft Queue task can be created only after approval and a separate create action.",
        ),
    })
}

fn normalize_note_draft(
    draft: CoordinatorProviderProposalDraftContext,
) -> Option<CoordinatorProviderProposalDraftContext> {
    if !matches_target(&draft, NOTE_TARGET_WIDGET, NOTE_TARGET_CAPABILITY) {
        return None;
    }

    let title = required_input_value(&draft, "Title")?;
    let body = required_input_value(&draft, "Body")?;
    let pinned = normalize_pinned(input_value(&draft, "Pinned").unwrap_or_default());

    Some(CoordinatorProviderProposalDraftContext {
        id: draft.id,
        type_id: NOTE_TYPE_ID.to_owned(),
        title: truncate_nonempty(draft.title, &title),
        target_widget: NOTE_TARGET_WIDGET.to_owned(),
        target_capability: NOTE_TARGET_CAPABILITY.to_owned(),
        intent: truncate_nonempty(draft.intent, "Create a workspace-local Note."),
        visible_inputs: vec![
            visible_input("Title", title),
            visible_input("Body", body),
            visible_input("Pinned", pinned),
        ],
        risk_notes: risk_notes_or(draft.risk_notes, note_risk_notes()),
        expected_result: truncate_nonempty(
            draft.expected_result,
            "A workspace-local Note can be created only after approval and a separate Create Note action.",
        ),
    })
}

fn normalize_jdbc_draft(
    draft: CoordinatorProviderProposalDraftContext,
) -> Option<CoordinatorProviderProposalDraftContext> {
    if !matches_target(&draft, JDBC_TARGET_WIDGET, JDBC_TARGET_CAPABILITY) {
        return None;
    }

    let question = input_value(&draft, "Question")
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| draft.intent.clone());
    let sql =
        input_value(&draft, "Suggested SQL text").unwrap_or_else(|| SQL_PLACEHOLDER.to_owned());
    let mut visible_inputs = vec![visible_input("Question", question)];

    if let Some(connector_label) = input_value(&draft, "Connector label") {
        if !connector_label.trim().is_empty() {
            visible_inputs.push(visible_input("Connector label", connector_label));
        }
    }

    visible_inputs.push(visible_input("Suggested SQL text", sql));

    Some(CoordinatorProviderProposalDraftContext {
        id: draft.id,
        type_id: JDBC_TYPE_ID.to_owned(),
        title: truncate_nonempty(draft.title, "JDBC query suggestion"),
        target_widget: JDBC_TARGET_WIDGET.to_owned(),
        target_capability: JDBC_TARGET_CAPABILITY.to_owned(),
        intent: truncate_nonempty(draft.intent, "Prepare non-executing SQL suggestion text."),
        visible_inputs,
        risk_notes: risk_notes_or(draft.risk_notes, jdbc_risk_notes()),
        expected_result: truncate_nonempty(
            draft.expected_result,
            "A SQL suggestion can be reviewed and copied, but it cannot execute SQL.",
        ),
    })
}

fn required_input_value(
    draft: &CoordinatorProviderProposalDraftContext,
    label: &str,
) -> Option<String> {
    input_value(draft, label).filter(|value| !value.trim().is_empty())
}

fn input_value(draft: &CoordinatorProviderProposalDraftContext, label: &str) -> Option<String> {
    draft
        .visible_inputs
        .iter()
        .find(|input| input.label.eq_ignore_ascii_case(label))
        .map(|input| truncate_chars(input.value.trim(), MAX_FIELD_CHARS))
}

fn visible_input(label: &str, value: impl Into<String>) -> CoordinatorProviderVisibleInput {
    CoordinatorProviderVisibleInput {
        label: label.to_owned(),
        value: truncate_chars(value.into().trim(), MAX_FIELD_CHARS),
    }
}

fn matches_target(
    draft: &CoordinatorProviderProposalDraftContext,
    target_widget: &str,
    target_capability: &str,
) -> bool {
    draft.target_widget.eq_ignore_ascii_case(target_widget)
        && draft
            .target_capability
            .eq_ignore_ascii_case(target_capability)
}

fn unsafe_target_or_capability(draft: &CoordinatorProviderProposalDraftContext) -> bool {
    let target = format!(
        "{} {} {} {}",
        draft.type_id, draft.target_widget, draft.target_capability, draft.intent
    )
    .to_lowercase();

    [
        "terminal",
        "git",
        "agent executor",
        "queue dispatch",
        "auto-dispatch",
        "start queue",
        "run queue",
        "execute sql",
        "run sql",
        "filesystem",
        "secret",
        "environment variable",
    ]
    .iter()
    .any(|needle| target.contains(needle))
}

fn risk_notes_or(provider_notes: Vec<String>, fallback: Vec<String>) -> Vec<String> {
    let notes = provider_notes
        .into_iter()
        .map(|note| truncate_chars(note.trim(), MAX_FIELD_CHARS))
        .filter(|note| !note.is_empty())
        .collect::<Vec<_>>();

    if notes.is_empty() {
        fallback
    } else {
        notes
    }
}

fn queue_risk_notes() -> Vec<String> {
    vec![
        "Queue task creation still requires approval plus a separate Create Queue task action."
            .to_owned(),
        "No Queue task is assigned, dispatched, run, or handed to Agent Executor automatically."
            .to_owned(),
        "Provider tools remained disabled with allowed_tools: [].".to_owned(),
    ]
}

fn note_risk_notes() -> Vec<String> {
    vec![
        "Note creation still requires approval plus a separate Create Note action.".to_owned(),
        "Only visible approved title, body, and pinned fields can be written.".to_owned(),
        "Existing Notes content is not read, searched, or summarized.".to_owned(),
    ]
}

fn jdbc_risk_notes() -> Vec<String> {
    vec![
        "SQL suggestion text is for review and copy only.".to_owned(),
        "No connector is accessed and no SQL or EXPLAIN is executed.".to_owned(),
        "No JDBC metadata, database results, credentials, or secrets are read.".to_owned(),
    ]
}

fn matches_any(message: &str, needles: &[&str]) -> bool {
    let lower = message.to_lowercase();
    needles.iter().any(|needle| lower.contains(needle))
}

fn labeled_value(message: &str, labels: &[&str]) -> Option<String> {
    let lower = message.to_lowercase();

    for label in labels {
        for separator in [":", "="] {
            let marker = format!("{label}{separator}");
            if let Some(index) = lower.find(&marker) {
                let start = index + marker.len();
                let value = message[start..]
                    .split([';', '\n'])
                    .next()
                    .unwrap_or_default()
                    .trim()
                    .trim_matches(['"', '\'']);

                if !value.is_empty() {
                    return Some(truncate_chars(value, MAX_FIELD_CHARS));
                }
            }
        }
    }

    None
}

fn extract_read_only_sql(message: &str) -> Option<String> {
    if let Some(sql) = fenced_sql(message) {
        return Some(sql);
    }

    if let Some(sql) = labeled_value(message, &["sql", "query"]) {
        if starts_with_read_only_sql(&sql) {
            return Some(sql);
        }
    }

    let lower = message.to_lowercase();
    for keyword in ["select", "with", "show", "describe", "explain"] {
        if let Some(index) = lower.find(keyword) {
            let sql = message[index..].trim();
            if starts_with_read_only_sql(sql) {
                return Some(truncate_chars(sql, MAX_FIELD_CHARS));
            }
        }
    }

    None
}

fn fenced_sql(message: &str) -> Option<String> {
    let start = message.find("```")?;
    let after_start = &message[start + 3..];
    let after_language = after_start
        .strip_prefix("sql")
        .unwrap_or(after_start)
        .trim_start();
    let end = after_language.find("```")?;
    let sql = after_language[..end].trim();

    if starts_with_read_only_sql(sql) {
        Some(truncate_chars(sql, MAX_FIELD_CHARS))
    } else {
        None
    }
}

fn starts_with_read_only_sql(value: &str) -> bool {
    matches!(
        value.trim_start().split_whitespace().next(),
        Some(keyword)
            if ["select", "with", "show", "describe", "explain"]
                .iter()
                .any(|allowed| keyword.eq_ignore_ascii_case(allowed))
    )
}

fn derived_title(message: &str, fallback: &str) -> String {
    let mut title = message.to_owned();
    for prefix in [
        "create agent queue task",
        "create queue task",
        "add agent queue task",
        "add queue task",
        "make task",
        "create a note",
        "create note",
        "save note",
        "write note",
        "prepare sql",
        "write sql",
        "suggest query",
    ] {
        title = replace_case_insensitive(&title, prefix, "");
    }

    let title = normalize_whitespace(title.trim_matches([':', '-', ' ']));
    let title = if title.is_empty() {
        fallback.to_owned()
    } else {
        title
    };

    truncate_chars(&title, MAX_TITLE_CHARS)
}

fn replace_case_insensitive(value: &str, needle: &str, replacement: &str) -> String {
    let Some(index) = value.to_lowercase().find(needle) else {
        return value.to_owned();
    };

    format!(
        "{}{}{}",
        &value[..index],
        replacement,
        &value[index + needle.len()..]
    )
}

fn normalize_whitespace(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn truncate_nonempty(value: String, fallback: &str) -> String {
    let trimmed = value.trim();

    if trimmed.is_empty() {
        truncate_chars(fallback, MAX_FIELD_CHARS)
    } else {
        truncate_chars(trimmed, MAX_FIELD_CHARS)
    }
}

fn truncate_chars(value: &str, max_chars: usize) -> String {
    if value.chars().count() <= max_chars {
        return value.to_owned();
    }

    let mut truncated = value.chars().take(max_chars).collect::<String>();
    truncated.push_str("...");
    truncated
}

fn clamp_priority(value: String) -> i32 {
    value.trim().parse::<i32>().unwrap_or(0).clamp(0, 5)
}

fn normalize_pinned(value: String) -> String {
    if matches!(
        value.trim().to_lowercase().as_str(),
        "true" | "yes" | "pinned" | "1"
    ) {
        "true".to_owned()
    } else {
        "false".to_owned()
    }
}
