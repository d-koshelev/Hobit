/// Coarse runtime family. This is classification only, not dispatch.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum RuntimeKind {
    Terminal,
    AgentExecutor,
    Git,
    Jdbc,
    CoordinatorProvider,
    #[default]
    Unknown,
}

/// Shared lifecycle vocabulary for runtime adapter requests.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum RuntimeExecutionStatus {
    #[default]
    Pending,
    Starting,
    Running,
    Succeeded,
    Failed,
    TimedOut,
    CancelRequested,
    Cancelled,
    ForceKillRequested,
    ForceKilled,
    Unsupported,
    NotConfigured,
}

/// Shared error categories for runtime adapter failures.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RuntimeErrorKind {
    NotConfigured,
    Unsupported,
    FailedToStart,
    ValidationFailed,
    PermissionDenied,
    TimedOut,
    Cancelled,
    ForceKilled,
    ExecutionFailed,
    OutputCapped,
    SecretRejected,
    Unknown,
}

/// Classification for runtime inputs, outputs, and artifacts.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RuntimeArtifactClass {
    SafeMetadata,
    OperatorText,
    CommandPayload,
    RawToolOutput,
    RuntimeError,
    LocalPath,
    SqlText,
    GeneratedResponse,
    EvidenceCandidate,
    SecretCandidate,
}

/// Redaction state is intentionally separate from size caps or truncation.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum RuntimeRedactionStatus {
    NotNeeded,
    NotRedacted,
    Redacted,
    ContainsSecretCandidate,
    ForbiddenSecretRemoved,
    #[default]
    Unknown,
}

#[cfg(test)]
mod tests {
    use super::{RuntimeExecutionStatus, RuntimeKind, RuntimeRedactionStatus};

    #[test]
    fn defaults_use_non_executing_and_unknown_values() {
        assert_eq!(RuntimeKind::Unknown, RuntimeKind::default());
        assert_eq!(
            RuntimeExecutionStatus::Pending,
            RuntimeExecutionStatus::default()
        );
        assert_eq!(
            RuntimeRedactionStatus::Unknown,
            RuntimeRedactionStatus::default()
        );
    }
}
