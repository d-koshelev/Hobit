use hobit_app::{
    AgentExecutorDiffFileSummary, AgentExecutorDiffSummary, AgentExecutorDiffTotals,
    GitDiffCommandSummary,
};

use crate::agent_executor_diff_dto::AgentExecutorDiffSummaryDto;

#[test]
fn maps_agent_executor_diff_summary_to_dto() {
    let dto = AgentExecutorDiffSummaryDto::from(AgentExecutorDiffSummary {
        repo_root: "C:/repo".to_owned(),
        status: "dirty".to_owned(),
        files: vec![AgentExecutorDiffFileSummary {
            path: "src/lib.rs".to_owned(),
            status: "modified".to_owned(),
            staged: false,
            unstaged: true,
            untracked: false,
            conflicted: false,
            additions: Some(3),
            deletions: Some(1),
            patch_preview: Some("diff --git a/src/lib.rs b/src/lib.rs".to_owned()),
            patch_truncated: true,
        }],
        summary: AgentExecutorDiffTotals {
            total_files: 1,
            staged_count: 0,
            unstaged_count: 1,
            untracked_count: 0,
            conflicted_count: 0,
            total_additions: Some(3),
            total_deletions: Some(1),
        },
        error_message: None,
        command_summary: vec![GitDiffCommandSummary {
            program: "git".to_owned(),
            args: vec![
                "-C".to_owned(),
                "C:/repo".to_owned(),
                "diff".to_owned(),
                "--numstat".to_owned(),
            ],
        }],
    });

    assert_eq!(dto.repo_root, "C:/repo");
    assert_eq!(dto.status, "dirty");
    assert_eq!(dto.summary.total_files, 1);
    assert_eq!(dto.summary.total_additions, Some(3));
    assert_eq!(dto.files[0].path, "src/lib.rs");
    assert!(dto.files[0].unstaged);
    assert!(dto.files[0].patch_truncated);
    assert_eq!(dto.command_summary[0].program, "git");
    assert_eq!(dto.command_summary[0].args[0], "-C");
}
