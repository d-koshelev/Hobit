//! Future structured tool and action adapter layer.
//!
//! This crate contains typed tool-facing foundations. Current execution is
//! limited to narrow internal read-only adapters; frontend and Tauri exposure
//! are added separately.

#![forbid(unsafe_code)]

pub mod codex_cli;
pub mod git;
pub mod git_diff;
pub mod process;
pub mod toolbelt;
