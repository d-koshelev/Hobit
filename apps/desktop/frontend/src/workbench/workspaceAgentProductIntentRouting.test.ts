import { describe, expect, it } from "vitest";

import { classifyWorkspaceAgentProductIntent } from "./workspaceAgentProductIntentRouting";

describe("workspaceAgentProductIntentRouting", () => {
  it("classifies example Queue item creation as an in-app Queue action", () => {
    expect(
      classifyWorkspaceAgentProductIntent("add example queue items to queue"),
    ).toEqual({
      kind: "queue_action",
      queueAction: "create_items",
      route: "agent_queue",
    });
  });

  it.each([
    "create queue items",
    "add tasks to queue",
    "create a queue task",
    "create tasks in Agent Queue",
    "break this into queue tasks",
    "make queue items from this",
  ])("routes %s to Agent Queue instead of Codex", (prompt) => {
    expect(classifyWorkspaceAgentProductIntent(prompt)).toMatchObject({
      kind: "queue_action",
      route: "agent_queue",
    });
  });

  it("keeps prompt-pack import on the prompt-pack product path", () => {
    expect(classifyWorkspaceAgentProductIntent("import prompt pack")).toEqual({
      kind: "prompt_pack_import",
      route: "prompt_pack",
    });
  });

  it("leaves ordinary coding prompts for the existing Codex/provider path", () => {
    expect(
      classifyWorkspaceAgentProductIntent("Fix the failing Workspace Agent test."),
    ).toEqual({
      kind: "none",
      route: "codex_or_provider",
    });
  });
});
