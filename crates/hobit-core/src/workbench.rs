//! Workbench placeholder types.

/// Identifier for a workbench surface.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct WorkbenchId(pub String);

/// Identifier for a running workbench session.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct WorkbenchSessionId(pub String);
