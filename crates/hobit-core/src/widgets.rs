//! Widget placeholder types.

/// Identifier for a reusable widget definition.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct WidgetDefinitionId(pub String);

/// Identifier for a configured widget instance in a workbench session.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct WidgetInstanceId(pub String);

/// Identifier for a reusable widget template.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct WidgetTemplateId(pub String);
