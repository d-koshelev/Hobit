use super::{
    context_warning, QueueTaskContextRef, QueueTaskContextWarning, KNOWLEDGE_DOCUMENT_EXCERPT_CHARS,
};

const LARGE_KNOWLEDGE_CONTENT_CHARS: usize = 100_000;

pub(super) fn knowledge_content_warnings(
    content: &str,
    ref_item: &QueueTaskContextRef,
    created_at: &str,
) -> Vec<QueueTaskContextWarning> {
    let mut warnings = Vec::new();
    let content_chars = content.chars().count();

    if content_chars > LARGE_KNOWLEDGE_CONTENT_CHARS {
        warnings.push(context_warning(
            ref_item,
            "warning",
            "large_content",
            created_at,
        ));
    } else if content_chars > KNOWLEDGE_DOCUMENT_EXCERPT_CHARS {
        warnings.push(context_warning(
            ref_item,
            "warning",
            "content_capped",
            created_at,
        ));
    }

    if contains_possible_secret(content) {
        warnings.push(context_warning(
            ref_item,
            "warning",
            "possible_secret",
            created_at,
        ));
    }

    warnings
}

fn contains_possible_secret(value: &str) -> bool {
    let lowered = value.to_ascii_lowercase();
    lowered.contains("-----begin private key-----")
        || lowered.contains("aws_secret_access_key")
        || lowered.contains("aws-secret-access-key")
        || value.contains("AKIA")
        || secret_assignment_present(&lowered)
}

fn secret_assignment_present(value: &str) -> bool {
    [
        "password",
        "passwd",
        "pwd",
        "api_key",
        "api-key",
        "secret",
        "token",
        "access_key",
        "access-key",
    ]
    .iter()
    .any(|key| {
        value
            .match_indices(key)
            .any(|(index, key)| has_assignment_after_key(&value[index + key.len()..]))
    })
}

fn has_assignment_after_key(tail: &str) -> bool {
    let trimmed = tail.trim_start();
    trimmed.starts_with('=') || trimmed.starts_with(':')
}
