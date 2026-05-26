const DEFAULT_KNOWLEDGE_SEARCH_LIMIT: usize = 5;
const MAX_KNOWLEDGE_SEARCH_LIMIT: usize = 20;
const MAX_KNOWLEDGE_SNIPPET_CHARS: usize = 900;

pub(super) fn normalized_knowledge_search_limit(limit: Option<usize>) -> usize {
    limit
        .unwrap_or(DEFAULT_KNOWLEDGE_SEARCH_LIMIT)
        .clamp(1, MAX_KNOWLEDGE_SEARCH_LIMIT)
}

pub(super) fn bounded_knowledge_snippet(text: &str) -> String {
    let compacted = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if compacted.chars().count() <= MAX_KNOWLEDGE_SNIPPET_CHARS {
        return compacted;
    }

    let mut snippet = compacted
        .chars()
        .take(MAX_KNOWLEDGE_SNIPPET_CHARS.saturating_sub(3))
        .collect::<String>();
    snippet.push_str("...");
    snippet
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn search_limit_preserves_default_and_caps() {
        assert_eq!(normalized_knowledge_search_limit(None), 5);
        assert_eq!(normalized_knowledge_search_limit(Some(0)), 1);
        assert_eq!(normalized_knowledge_search_limit(Some(3)), 3);
        assert_eq!(normalized_knowledge_search_limit(Some(200)), 20);
    }

    #[test]
    fn snippet_compacts_whitespace_and_caps_text() {
        assert_eq!(
            bounded_knowledge_snippet("One\n\n two\tthree"),
            "One two three"
        );

        let long = "a".repeat(1_000);
        let snippet = bounded_knowledge_snippet(&long);

        assert_eq!(snippet.chars().count(), 900);
        assert!(snippet.ends_with("..."));
    }
}
