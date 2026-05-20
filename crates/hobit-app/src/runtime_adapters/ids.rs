use std::fmt;

macro_rules! runtime_id {
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

runtime_id!(RuntimeAdapterId);
runtime_id!(RuntimeRequestId);
runtime_id!(RuntimeCorrelationId);

#[cfg(test)]
mod tests {
    use super::{RuntimeAdapterId, RuntimeCorrelationId, RuntimeRequestId};

    #[test]
    fn constructs_runtime_boundary_ids() {
        let adapter_id = RuntimeAdapterId::new("terminal-pty");
        let request_id = RuntimeRequestId::from("request-1");
        let correlation_id = RuntimeCorrelationId::from("correlation-1".to_owned());

        assert_eq!("terminal-pty", adapter_id.as_str());
        assert_eq!("request-1", request_id.as_str());
        assert_eq!("correlation-1", correlation_id.as_str());
    }
}
