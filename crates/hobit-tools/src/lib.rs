//! Future structured tool and action adapter layer.
//!
//! This crate contains typed tool-facing foundations. Current execution is
//! limited to narrow internal read-only adapters; frontend and Tauri exposure
//! are added separately.

#![forbid(unsafe_code)]

pub mod git;
pub mod process;
