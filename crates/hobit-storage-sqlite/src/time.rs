//! Timestamp helpers used by SQLite storage methods.

use std::time::{SystemTime, UNIX_EPOCH};

pub(crate) fn now_timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_owned())
}

pub(crate) fn now_precise_timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| format!("{}.{:09}", duration.as_secs(), duration.subsec_nanos()))
        .unwrap_or_else(|_| "0.000000000".to_owned())
}
