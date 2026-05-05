//! Action proposal and operator decision contracts.
//!
//! Actions describe proposed work that may affect the Workbench, external
//! systems, files, data, or generated outputs. Decisions model explicit
//! operator control. This module contains contracts only, not execution logic.

use crate::widgets::WidgetInstanceId;

/// Identifier for a proposed action.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct ActionProposalId(pub String);

impl ActionProposalId {
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }
}

/// Identifier for an operator decision request.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct DecisionRequestId(pub String);

impl DecisionRequestId {
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }
}

/// Risk level for a proposed action.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ActionRiskLevel {
    Low,
    Medium,
    High,
    Destructive,
}

/// A structured proposal for work before execution.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ActionProposal {
    pub id: ActionProposalId,
    pub title: String,
    pub summary: String,
    pub purpose: String,
    pub expected_output: Option<String>,
    pub risk: ActionRiskLevel,
    pub requires_approval: bool,
    pub source_widget_id: Option<WidgetInstanceId>,
    pub payload: String,
    pub references: Vec<String>,
}

/// Runtime status of an operator decision request.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DecisionRequestStatus {
    Open,
    Approved,
    Rejected,
    Cancelled,
}

/// A request for operator approval, rejection, selection, or clarification.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DecisionRequest {
    pub id: DecisionRequestId,
    pub proposal_id: Option<ActionProposalId>,
    pub title: String,
    pub question: String,
    pub options: Vec<String>,
    pub status: DecisionRequestStatus,
    pub selected_option: Option<String>,
    pub rationale: Option<String>,
}
