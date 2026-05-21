use std::fmt;

use crate::audit_events::AuditArtifactId;

macro_rules! artifact_id {
    ($name:ident) => {
        #[derive(Clone, Eq, Hash, Ord, PartialEq, PartialOrd)]
        pub struct $name(String);

        impl $name {
            pub fn new(value: impl Into<String>) -> Self {
                Self(value.into())
            }

            pub fn as_str(&self) -> &str {
                &self.0
            }
        }

        impl fmt::Debug for $name {
            fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter
                    .debug_tuple(stringify!($name))
                    .field(&self.0)
                    .finish()
            }
        }

        impl From<&str> for $name {
            fn from(value: &str) -> Self {
                Self::new(value)
            }
        }

        impl From<String> for $name {
            fn from(value: String) -> Self {
                Self::new(value)
            }
        }
    };
}

artifact_id!(ArtifactId);
artifact_id!(ArtifactWorkspaceRef);
artifact_id!(ArtifactWorkbenchRef);
artifact_id!(ArtifactWidgetInstanceRef);
artifact_id!(ArtifactWidgetDefinitionRef);
artifact_id!(ArtifactWidgetRunRef);
artifact_id!(ArtifactWidgetResultRef);
artifact_id!(ArtifactWidgetLogRef);
artifact_id!(ArtifactQueueTaskRef);
artifact_id!(ArtifactDirectWorkRunRef);
artifact_id!(ArtifactTerminalRunRef);
artifact_id!(ArtifactTerminalSessionRef);
artifact_id!(ArtifactGitStatusRef);
artifact_id!(ArtifactGitDiffRef);
artifact_id!(ArtifactGitCommitRef);
artifact_id!(ArtifactJdbcQueryRef);
artifact_id!(ArtifactJdbcResultRef);
artifact_id!(ArtifactNoteRef);
artifact_id!(ArtifactCoordinatorProposalRef);
artifact_id!(ArtifactExternalSourceRef);

impl From<ArtifactId> for AuditArtifactId {
    fn from(value: ArtifactId) -> Self {
        Self::new(value.as_str().to_owned())
    }
}

impl From<&ArtifactId> for AuditArtifactId {
    fn from(value: &ArtifactId) -> Self {
        Self::new(value.as_str().to_owned())
    }
}
