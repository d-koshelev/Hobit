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
        to inspect git status/diff, or refresh the Git widget manually after the
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

export function CodexDirectWorkActionSafetyCopy() {
  return (
    <p className="codex-direct-work-safety-copy">
      Direct Work can edit files inside the selected execution workspace when
      workspace-write is selected. No commit or push is created automatically.
      Review changes afterwards. This is one-shot, not an interactive terminal.
    </p>
  );
}
