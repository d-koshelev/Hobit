use std::fmt;

macro_rules! audit_id {
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

audit_id!(AuditEventId);
audit_id!(AuditOrganizationRef);
audit_id!(AuditWorkspaceRef);
audit_id!(AuditWorkbenchRef);
audit_id!(AuditWidgetInstanceRef);
audit_id!(AuditWidgetDefinitionRef);
audit_id!(AuditCapabilityRef);
audit_id!(AuditTaskRef);
audit_id!(AuditRunRef);
audit_id!(AuditActionRef);
audit_id!(AuditCausationId);
audit_id!(AuditCorrelationId);
audit_id!(AuditApprovalId);
audit_id!(AuditArtifactId);
