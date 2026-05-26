export type WorkspaceAgentVisibleContext = {
  contextText: string;
  sourceLabel: string;
};

export const EMPTY_WORKSPACE_AGENT_VISIBLE_CONTEXT: WorkspaceAgentVisibleContext | null =
  null;

export function workspaceAgentVisibleContextBlock(
  context: WorkspaceAgentVisibleContext,
) {
  return [
    `Visible attached context (${context.sourceLabel})`,
    context.contextText,
    "Only visible attached context is sent.",
  ].join("\n");
}

export function appendWorkspaceAgentVisibleContextBlock(
  currentDraft: string,
  block: string,
) {
  const trimmedDraft = currentDraft.trim();

  if (!trimmedDraft) {
    return block;
  }

  return `${trimmedDraft}\n\n${block}`;
}

export function removeWorkspaceAgentVisibleContextFromDraft(
  currentDraft: string,
  context: WorkspaceAgentVisibleContext,
) {
  const block = workspaceAgentVisibleContextBlock(context);

  return currentDraft.includes(block)
    ? currentDraft.replace(block, "").trimStart()
    : currentDraft;
}

export function hasWorkspaceAgentVisibleContext(
  context: WorkspaceAgentVisibleContext | null,
) {
  return Boolean(context?.contextText.trim() && context.sourceLabel.trim());
}
