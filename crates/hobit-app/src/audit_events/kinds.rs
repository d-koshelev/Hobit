#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AuditActorKind {
    LocalOperator,
    System,
    Provider,
    Runtime,
    Unknown,
}

impl Default for AuditActorKind {
    fn default() -> Self {
        Self::Unknown
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AuditApprovalStatus {
    Requested,
    Approved,
    Rejected,
    NotRequired,
    Unknown,
}

impl Default for AuditApprovalStatus {
    fn default() -> Self {
        Self::Unknown
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AuditEventKind {
    WorkspaceCreated,
    WidgetAdded,
    CapabilityRequested,
    CapabilityApproved,
    CapabilityRejected,
    RuntimeStarted,
    RuntimeEventObserved,
    RuntimeCompleted,
    RuntimeFailed,
    TaskCreated,
    TaskUpdated,
    TaskStarted,
    TaskCompleted,
    ArtifactCreated,
    ProposalCreated,
    ProposalApproved,
    NoteCreated,
    Unknown,
}

impl Default for AuditEventKind {
    fn default() -> Self {
        Self::Unknown
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AuditRiskLevel {
    ReadOnly,
    AnalysisOnly,
    LocalWrite,
    ExternalRead,
    ExternalWrite,
    Destructive,
    SecretSensitive,
    Unknown,
}

impl Default for AuditRiskLevel {
    fn default() -> Self {
        Self::Unknown
    }
}
