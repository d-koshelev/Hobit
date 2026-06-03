type CodexDirectWorkPromptGuidanceProps = {
  promptWarningMessage: string | null;
};

export function CodexDirectWorkPromptGuidance({
  promptWarningMessage,
}: CodexDirectWorkPromptGuidanceProps) {
  return (
    <>
      <p className="codex-direct-work-note">
        Codex Direct Work stays inside the selected execution workspace. It
        cannot click or inspect Hobit UI widgets. For repository work, ask Codex
        to inspect git status/diff, then review Workspace Git status after the
        run.
      </p>
      {promptWarningMessage ? (
        <p className="codex-direct-work-warning" role="status">
          {promptWarningMessage}
        </p>
      ) : null}
    </>
  );
}

export function CodexDirectWorkWorkspaceWriteWarning() {
  return (
    <p className="codex-direct-work-warning" role="status">
      workspace_write allows Codex to edit files inside the selected execution workspace.
    </p>
  );
}

export function CodexDirectWorkDangerFullAccessWarning() {
  return (
    <p className="codex-direct-work-warning" role="alert">
      danger_full_access is unsafe and intended only for trusted local
      development. It disables Codex sandbox restrictions. Git mutations remain
      forbidden unless explicitly requested; Hobit will still not auto-commit,
      push, reset, clean, stash, or roll back changes.
    </p>
  );
}

export function CodexDirectWorkActionSafetyCopy() {
  return (
    <p className="codex-direct-work-safety-copy">
      Direct Work can edit files inside the selected execution workspace with
      workspace_write, or broadly on this machine with danger_full_access. No
      commit, push, reset, clean, stash, or rollback is performed automatically.
      Review changes afterwards. This is one-shot, not an interactive terminal.
    </p>
  );
}
