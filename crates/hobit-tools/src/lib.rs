//! Future structured tool and action adapter layer.
//!
//! This crate contains typed tool-facing foundations. Current execution is
//! limited to narrow internal read-only adapters; frontend and Tauri exposure
//! are added separately.

#![forbid(unsafe_code)]

pub mod codex_cli;
pub mod git;
pub mod git_commit;
pub mod git_diff;
pub mod git_push;
pub mod process;
pub mod toolbelt;

#[cfg(test)]
mod git_commit_tests;
