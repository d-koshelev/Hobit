//! Core Hobit domain contracts.
//!
//! This crate contains dependency-free Rust representations of the canonical
//! Workspace, Workbench, Preset, Widget runtime, action, event, and shared state
//! contracts. It does not implement persistence, frontend behavior, Tauri
//! integration, agent calls, tool execution, or concrete widgets.

#![forbid(unsafe_code)]

pub mod actions;
pub mod agent;
pub mod events;
pub mod presets;
pub mod state;
pub mod widgets;
pub mod workbench;
