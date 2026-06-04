use std::fmt;

use super::redaction::contains_secret_like;

#[derive(Clone, Eq, PartialEq)]
pub struct AuditEventSummary {
    text: String,
}

impl AuditEventSummary {
    pub fn new(text: impl Into<String>) -> Self {
        Self { text: text.into() }
    }

    pub fn as_str(&self) -> &str {
        &self.text
    }
}

impl fmt::Debug for AuditEventSummary {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("AuditEventSummary")
            .field("text_present", &true)
            .field("text_bytes", &self.text.len())
            .field(
                "contains_secret_candidate",
                &contains_secret_like(&self.text),
            )
            .finish()
    }
}

#[derive(Clone, Eq, PartialEq)]
pub struct AuditErrorClass {
    label: String,
}

impl AuditErrorClass {
    pub fn new(label: impl Into<String>) -> Self {
        Self {
            label: label.into(),
        }
    }

    pub fn as_str(&self) -> &str {
        &self.label
    }
}

impl fmt::Debug for AuditErrorClass {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("AuditErrorClass")
            .field("label_present", &true)
            .field("label_bytes", &self.label.len())
            .field(
                "contains_secret_candidate",
                &contains_secret_like(&self.label),
            )
            .finish()
    }
}
