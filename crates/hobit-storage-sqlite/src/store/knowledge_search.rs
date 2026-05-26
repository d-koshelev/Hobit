use crate::rows::KnowledgeDocumentSearchResultRow;

const TARGET_CHUNK_CHARS: usize = 1_600;
const MAX_CHUNK_CHARS: usize = 2_000;
const MIN_CHUNK_CHARS: usize = 1_000;
const MAX_SEARCH_LIMIT: usize = 20;

pub(crate) fn capped_search_limit(limit: usize) -> usize {
    limit.clamp(1, MAX_SEARCH_LIMIT)
}

pub(crate) fn chunk_knowledge_document_content(content: &str) -> Vec<String> {
    let normalized = content.replace("\r\n", "\n").replace('\r', "\n");
    let paragraphs = normalized
        .split("\n\n")
        .map(str::trim)
        .filter(|paragraph| !paragraph.is_empty())
        .collect::<Vec<_>>();

    if paragraphs.is_empty() {
        return Vec::new();
    }

    let mut chunks = Vec::new();
    let mut current = String::new();

    for paragraph in paragraphs {
        append_paragraph_to_chunks(paragraph, &mut current, &mut chunks);
    }

    if !current.trim().is_empty() {
        chunks.push(current.trim().to_owned());
    }

    chunks
}

pub(crate) fn lexical_terms(query: &str) -> Vec<String> {
    query
        .to_lowercase()
        .split(|character: char| !character.is_alphanumeric())
        .map(str::trim)
        .filter(|term| term.len() >= 2)
        .map(str::to_owned)
        .fold(Vec::new(), |mut terms, term| {
            if !terms.contains(&term) {
                terms.push(term);
            }
            terms
        })
}

pub(crate) fn knowledge_search_score(
    row: &KnowledgeDocumentSearchResultRow,
    terms: &[String],
) -> i64 {
    let title = row.document_title.to_lowercase();
    let source = row.source_label.to_lowercase();
    let tags = row.tags.to_lowercase();
    let text = row.text.to_lowercase();

    terms
        .iter()
        .map(|term| {
            10 * count_matches(&title, term)
                + 6 * count_matches(&tags, term)
                + 4 * count_matches(&source, term)
                + 2 * count_matches(&text, term)
        })
        .sum()
}

pub(crate) fn sort_knowledge_search_results(results: &mut [KnowledgeDocumentSearchResultRow]) {
    results.sort_by(|left, right| {
        right
            .score
            .cmp(&left.score)
            .then_with(|| left.document_title.cmp(&right.document_title))
            .then_with(|| left.chunk_index.cmp(&right.chunk_index))
    });
}

fn append_paragraph_to_chunks(paragraph: &str, current: &mut String, chunks: &mut Vec<String>) {
    if paragraph.chars().count() > MAX_CHUNK_CHARS {
        if !current.trim().is_empty() {
            chunks.push(current.trim().to_owned());
            current.clear();
        }
        split_large_paragraph(paragraph, chunks);
        return;
    }

    let separator_chars = if current.is_empty() { 0 } else { 2 };
    let next_len = current.chars().count() + separator_chars + paragraph.chars().count();
    if next_len > TARGET_CHUNK_CHARS && current.chars().count() >= MIN_CHUNK_CHARS {
        chunks.push(current.trim().to_owned());
        current.clear();
    }

    if !current.is_empty() {
        current.push_str("\n\n");
    }
    current.push_str(paragraph);

    if current.chars().count() >= MAX_CHUNK_CHARS {
        chunks.push(current.trim().to_owned());
        current.clear();
    }
}

fn split_large_paragraph(paragraph: &str, chunks: &mut Vec<String>) {
    let mut current = String::new();

    for word in paragraph.split_whitespace() {
        let separator_chars = if current.is_empty() { 0 } else { 1 };
        let next_len = current.chars().count() + separator_chars + word.chars().count();
        if next_len > TARGET_CHUNK_CHARS && !current.is_empty() {
            chunks.push(current.trim().to_owned());
            current.clear();
        }
        if !current.is_empty() {
            current.push(' ');
        }
        current.push_str(word);
    }

    if !current.trim().is_empty() {
        chunks.push(current.trim().to_owned());
    }
}

fn count_matches(haystack: &str, needle: &str) -> i64 {
    haystack.matches(needle).count() as i64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chunking_is_deterministic_and_normalizes_line_endings() {
        let lf = "# Heading\n\nFirst paragraph.\n\nSecond paragraph.";
        let crlf = "# Heading\r\n\r\nFirst paragraph.\r\n\r\nSecond paragraph.";

        assert_eq!(
            chunk_knowledge_document_content(lf),
            chunk_knowledge_document_content(crlf)
        );
    }

    #[test]
    fn lexical_terms_are_normalized_unique_and_short_terms_are_ignored() {
        assert_eq!(
            lexical_terms("Deploy, deploy! A db rollback"),
            vec!["deploy", "db", "rollback"]
        );
    }

    #[test]
    fn search_limit_is_capped_with_existing_minimum_and_maximum() {
        assert_eq!(capped_search_limit(0), 1);
        assert_eq!(capped_search_limit(5), 5);
        assert_eq!(capped_search_limit(200), 20);
    }
}
