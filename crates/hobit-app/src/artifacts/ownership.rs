use crate::capabilities::CapabilityActionRef;

use super::{
    ArtifactCoordinatorProposalRef, ArtifactExternalSourceRef, ArtifactNoteRef,
    ArtifactQueueTaskRef, ArtifactWidgetDefinitionRef, ArtifactWidgetInstanceRef,
    ArtifactWidgetRunRef, ArtifactWorkbenchRef, ArtifactWorkspaceRef,
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ArtifactOwnerRef {
    pub owner_kind: ArtifactOwnerKind,
    pub workspace_id: Option<ArtifactWorkspaceRef>,
    pub workbench_id: Option<ArtifactWorkbenchRef>,
    pub widget_instance_id: Option<ArtifactWidgetInstanceRef>,
    pub widget_definition_id: Option<ArtifactWidgetDefinitionRef>,
    pub queue_task_id: Option<ArtifactQueueTaskRef>,
    pub runtime_run_id: Option<ArtifactWidgetRunRef>,
    pub capability_action: Option<CapabilityActionRef>,
    pub note_id: Option<ArtifactNoteRef>,
    pub coordinator_proposal_id: Option<ArtifactCoordinatorProposalRef>,
    pub external_source_id: Option<ArtifactExternalSourceRef>,
}

impl ArtifactOwnerRef {
    pub fn workspace(workspace_id: impl Into<ArtifactWorkspaceRef>) -> Self {
        Self {
            owner_kind: ArtifactOwnerKind::Workspace,
            workspace_id: Some(workspace_id.into()),
            workbench_id: None,
            widget_instance_id: None,
            widget_definition_id: None,
            queue_task_id: None,
            runtime_run_id: None,
            capability_action: None,
            note_id: None,
            coordinator_proposal_id: None,
            external_source_id: None,
        }
    }

    pub fn workbench(
        workspace_id: impl Into<ArtifactWorkspaceRef>,
        workbench_id: impl Into<ArtifactWorkbenchRef>,
    ) -> Self {
        Self {
            workbench_id: Some(workbench_id.into()),
            owner_kind: ArtifactOwnerKind::Workbench,
            ..Self::workspace(workspace_id)
        }
    }

    pub fn widget(
        workspace_id: impl Into<ArtifactWorkspaceRef>,
        workbench_id: impl Into<ArtifactWorkbenchRef>,
        widget_instance_id: impl Into<ArtifactWidgetInstanceRef>,
        widget_definition_id: impl Into<ArtifactWidgetDefinitionRef>,
    ) -> Self {
        Self {
            owner_kind: ArtifactOwnerKind::Widget,
            widget_instance_id: Some(widget_instance_id.into()),
            widget_definition_id: Some(widget_definition_id.into()),
            ..Self::workbench(workspace_id, workbench_id)
        }
    }

    pub fn queue_task(
        workspace_id: impl Into<ArtifactWorkspaceRef>,
        queue_task_id: impl Into<ArtifactQueueTaskRef>,
    ) -> Self {
        Self {
            owner_kind: ArtifactOwnerKind::QueueTask,
            queue_task_id: Some(queue_task_id.into()),
            ..Self::workspace(workspace_id)
        }
    }

    pub fn runtime_run(
        workspace_id: impl Into<ArtifactWorkspaceRef>,
        workbench_id: impl Into<ArtifactWorkbenchRef>,
        widget_instance_id: impl Into<ArtifactWidgetInstanceRef>,
        widget_definition_id: impl Into<ArtifactWidgetDefinitionRef>,
        runtime_run_id: impl Into<ArtifactWidgetRunRef>,
    ) -> Self {
        Self {
            owner_kind: ArtifactOwnerKind::RuntimeRun,
            runtime_run_id: Some(runtime_run_id.into()),
            ..Self::widget(
                workspace_id,
                workbench_id,
                widget_instance_id,
                widget_definition_id,
            )
        }
    }

    pub fn capability_action(
        workspace_id: impl Into<ArtifactWorkspaceRef>,
        action: CapabilityActionRef,
    ) -> Self {
        Self {
            owner_kind: ArtifactOwnerKind::CapabilityAction,
            capability_action: Some(action),
            ..Self::workspace(workspace_id)
        }
    }

    pub fn note(
        workspace_id: impl Into<ArtifactWorkspaceRef>,
        note_id: impl Into<ArtifactNoteRef>,
    ) -> Self {
        Self {
            owner_kind: ArtifactOwnerKind::Note,
            note_id: Some(note_id.into()),
            ..Self::workspace(workspace_id)
        }
    }

    pub fn coordinator_proposal(
        workspace_id: impl Into<ArtifactWorkspaceRef>,
        proposal_id: impl Into<ArtifactCoordinatorProposalRef>,
    ) -> Self {
        Self {
            owner_kind: ArtifactOwnerKind::CoordinatorProposal,
            coordinator_proposal_id: Some(proposal_id.into()),
            ..Self::workspace(workspace_id)
        }
    }

    pub fn external_source(source_id: impl Into<ArtifactExternalSourceRef>) -> Self {
        Self {
            owner_kind: ArtifactOwnerKind::ExternalSource,
            workspace_id: None,
            workbench_id: None,
            widget_instance_id: None,
            widget_definition_id: None,
            queue_task_id: None,
            runtime_run_id: None,
            capability_action: None,
            note_id: None,
            coordinator_proposal_id: None,
            external_source_id: Some(source_id.into()),
        }
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum ArtifactOwnerKind {
    Workspace,
    Workbench,
    Widget,
    QueueTask,
    RuntimeRun,
    CapabilityAction,
    Note,
    CoordinatorProposal,
    ExternalSource,
    #[default]
    Unknown,
}
