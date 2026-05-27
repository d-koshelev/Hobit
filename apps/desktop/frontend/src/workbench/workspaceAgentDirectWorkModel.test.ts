import { describe, expect, it } from "vitest";

import type {
  DirectWorkStreamEvent,
  KnowledgeDocumentSearchResult,
} from "../workspace/types";
import {
  DIRECT_WORK_DIRECTORY_ACCESS_DENIED_MESSAGE,
  DIRECT_WORK_FALLBACK_FAILURE_MESSAGE,
  EMPTY_WORKSPACE_AGENT_ACTIVITY_SUMMARY,
  codexAgentMessageFromEvent,
  codexPromptWithWorkspaceKnowledge,
  codexThreadIdForScope,
  compactDirectWorkText,
  coordinatorDirectWorkStatusFromEvent,
  directWorkDirectoryResolutionText,
  directWorkEventBelongsToCurrentAgent,
  directWorkEventHasAccessDenied,
  directWorkEventText,
  directWorkFailureIsAccessDenied,
  directWorkFailureReason,
  directWorkFailureTranscriptBody,
  directWorkScratchWorkspaceSuggestion,
  shortCodexThreadId,
  workspaceKnowledgeLogText,
  workspaceKnowledgeSummaryText,
  workspaceAgentActivitySummaryFromEvent,
  type CodexThreadScope,
  type WorkspaceAgentActivitySummary,
  type WorkspaceKnowledgeLookup,
} from "./workspaceAgentDirectWorkModel";

describe("workspaceAgentDirectWorkModel", () => {
  it("formats final Direct Work status from stream events", () => {
    expect(
      coordinatorDirectWorkStatusFromEvent(
        directWorkEvent({ eventKind: "completed", finalStatus: "completed" }),
      ),
    ).toBe("completed");
    expect(
      coordinatorDirectWorkStatusFromEvent(
        directWorkEvent({ eventKind: "cancelled", finalStatus: "cancelled" }),
      ),
    ).toBe("cancelled");
    expect(
      coordinatorDirectWorkStatusFromEvent(
        directWorkEvent({ eventKind: "timed_out", finalStatus: "timed_out" }),
      ),
    ).toBe("failed");
  });

  it("keeps Direct Work failure reason and transcript formatting stable", () => {
    const errorEvent = directWorkEvent({
      errorMessage: "Codex executable not found",
      eventKind: "failed",
      finalStatus: "failed",
    });
    const fallbackEvent = directWorkEvent({
      eventKind: "failed",
      finalStatus: "failed",
    });

    expect(directWorkFailureReason(errorEvent, false)).toBe(
      "Codex executable not found",
    );
    expect(directWorkFailureTranscriptBody("Codex executable not found")).toBe(
      "Direct Work failed: Codex executable not found",
    );
    expect(directWorkFailureReason(fallbackEvent, false)).toBe(
      DIRECT_WORK_FALLBACK_FAILURE_MESSAGE,
    );
    expect(
      directWorkFailureTranscriptBody(DIRECT_WORK_FALLBACK_FAILURE_MESSAGE),
    ).toBe(DIRECT_WORK_FALLBACK_FAILURE_MESSAGE);
  });

  it("maps access denied failures to the stable operator-facing message", () => {
    const event = directWorkEvent({
      eventKind: "failed",
      finalStatus: "failed",
      stderrPreview: "UnauthorizedAccessException: access is denied",
    });

    expect(directWorkEventHasAccessDenied(event)).toBe(true);
    expect(directWorkFailureIsAccessDenied(event, false)).toBe(true);
    expect(directWorkFailureIsAccessDenied(directWorkEvent(), true)).toBe(true);
    expect(directWorkFailureReason(event, false)).toBe(
      DIRECT_WORK_DIRECTORY_ACCESS_DENIED_MESSAGE,
    );
  });

  it("matches Codex thread scope only for the same workspace agent and directory", () => {
    const thread: CodexThreadScope = {
      threadId: "thread-1234567890",
      widgetInstanceId: "widget-1",
      workingDirectory: "C:/repo",
      workspaceId: "workspace-1",
    };

    expect(
      codexThreadIdForScope(thread, "workspace-1", "widget-1", "C:/repo"),
    ).toBe("thread-1234567890");
    expect(
      codexThreadIdForScope(thread, "workspace-2", "widget-1", "C:/repo"),
    ).toBeNull();
    expect(
      codexThreadIdForScope(thread, "workspace-1", "widget-2", "C:/repo"),
    ).toBeNull();
    expect(
      codexThreadIdForScope(thread, "workspace-1", "widget-1", "C:/other"),
    ).toBeNull();
    expect(codexThreadIdForScope(null, "workspace-1", "widget-1", "C:/repo"))
      .toBeNull();
  });

  it("checks stream event ownership against current workspace agent scope", () => {
    const event = directWorkEvent({
      widgetInstanceId: "widget-1",
      workspaceId: "workspace-1",
    });

    expect(
      directWorkEventBelongsToCurrentAgent(event, "workspace-1", "widget-1"),
    ).toBe(true);
    expect(
      directWorkEventBelongsToCurrentAgent(event, " workspace-1 ", "widget-1"),
    ).toBe(true);
    expect(
      directWorkEventBelongsToCurrentAgent(event, "workspace-2", "widget-1"),
    ).toBe(false);
    expect(
      directWorkEventBelongsToCurrentAgent(event, "workspace-1", "widget-2"),
    ).toBe(false);
    expect(directWorkEventBelongsToCurrentAgent(event, undefined, "widget-1"))
      .toBe(true);
  });

  it("keeps working directory helper text and scratch suggestion behavior", () => {
    expect(directWorkDirectoryResolutionText("")).toBe(
      "Required before start.",
    );
    expect(directWorkDirectoryResolutionText("~")).toBe(
      "~ resolves to your user home.",
    );
    expect(directWorkDirectoryResolutionText("~/project")).toBe(
      "~ resolves to your user home.",
    );
    expect(directWorkDirectoryResolutionText("C:/repo")).toBe(
      "Using selected working directory.",
    );

    expect(directWorkScratchWorkspaceSuggestion("")).toBeNull();
    expect(directWorkScratchWorkspaceSuggestion("~")).toBe(
      "/Documents/hobit-workspace-agent-scratch",
    );
    expect(directWorkScratchWorkspaceSuggestion("C:/Users/Dmitry")).toBe(
      "/Documents/hobit-workspace-agent-scratch",
    );
    expect(directWorkScratchWorkspaceSuggestion("C:/repo")).toBeNull();
  });

  it("formats workspace knowledge summary, log text, and Codex prompt block", () => {
    const results = Array.from({ length: 6 }, (_, index) =>
      knowledgeResult(index),
    );
    const lookup: WorkspaceKnowledgeLookup = {
      error: null,
      query: "task",
      results,
      status: "matched",
    };

    expect(workspaceKnowledgeSummaryText(lookup)).toBe(
      "Used knowledge: 6 snippets",
    );
    expect(workspaceKnowledgeLogText(lookup)).toBe("Used knowledge: 6 snippets.");
    expect(
      workspaceKnowledgeSummaryText({
        error: null,
        query: "task",
        results: [],
        status: "checked",
      }),
    ).toBe("Workspace knowledge checked: no matches");
    expect(
      workspaceKnowledgeLogText({
        error: "failed",
        query: "task",
        results: [],
        status: "failed",
      }),
    ).toBe("Workspace knowledge check failed; continuing without it.");

    const prompt = codexPromptWithWorkspaceKnowledge("Refactor this", results);

    expect(prompt).toContain("Workspace knowledge found for this request:");
    expect(prompt).toContain("[Doc: Doc 1, chunk 1]\nScope: Workspace\nSnippet 1");
    expect(prompt).toContain("Scope: Workspace");
    expect(prompt).toContain("[Doc: Doc 5, chunk 5]\nScope: Workspace\nSnippet 5");
    expect(prompt).not.toContain("Doc 6");
    expect(prompt).toContain("User request:\nRefactor this");
  });

  it("formats stream event log text and compact thread ids", () => {
    expect(shortCodexThreadId("thread-1234567890")).toBe("thread-...");
    expect(shortCodexThreadId("thread-1")).toBe("thread-1");
    expect(directWorkEventText(directWorkEvent({ eventKind: "started" }))).toBe(
      "Run run-1 started.",
    );
    expect(
      directWorkEventText(
        directWorkEvent({
          codexThreadId: "thread-1234567890",
          eventKind: "stdout_line",
        }),
      ),
    ).toBe("Codex thread active: thread-....");
    expect(
      directWorkEventText(directWorkEvent({ eventKind: "final_message" })),
    ).toBe("Final response received.");
    expect(
      directWorkEventText(
        directWorkEvent({
          eventKind: "failed",
          finalStatus: "failed",
          isFinal: true,
        }),
      ),
    ).toBe("Run ended with failed.");
    expect(
      compactDirectWorkText(` ${"word ".repeat(60)}
      next `),
    ).toHaveLength(180);
  });

  it("extracts only final Codex agent messages from JSON stream events", () => {
    expect(
      codexAgentMessageFromEvent(
        directWorkEvent({
          eventKind: "codex_json_event",
          parsedCodexEventType: "agent_message",
          text: " Final answer ",
        }),
      ),
    ).toBe("Final answer");
    expect(
      codexAgentMessageFromEvent(
        directWorkEvent({
          eventKind: "codex_json_event",
          line: JSON.stringify({
            item: {
              content: [{ text: "Line 1" }, { content: "Line 2" }],
              type: "agent_message",
            },
            type: "item.completed",
          }),
        }),
      ),
    ).toBe("Line 1\nLine 2");
    expect(
      codexAgentMessageFromEvent(
        directWorkEvent({
          eventKind: "codex_json_event",
          parsedCodexEventType: "lifecycle",
          text: "Running command",
        }),
      ),
    ).toBeNull();
    expect(codexAgentMessageFromEvent(directWorkEvent({ eventKind: "stdout_line" })))
      .toBeNull();
  });

  it("maps command_execution started to a readable running command activity", () => {
    const summary = activityFromEvents([
      codexJsonEvent({
        item: {
          args: ["status", "--short"],
          command: "git",
          type: "command_execution",
        },
        type: "item.started",
      }),
    ]);

    expect(summary).toMatchObject({
      latestTitle: "Running command: git status --short",
      severity: "info",
      shortText: "Running command: git status --short",
      status: "running",
      stepCount: 1,
    });
  });

  it("maps command_execution completed to a readable finished command activity", () => {
    const summary = activityFromEvents([
      codexJsonEvent({
        item: {
          args: ["check"],
          command: "cargo",
          exit_code: 0,
          type: "command_execution",
        },
        type: "item.completed",
      }),
    ]);

    expect(summary).toMatchObject({
      latestTitle: "Finished command: cargo check",
      severity: "success",
      shortText: "Finished command: cargo check",
      status: "running",
      stepCount: 1,
    });
  });

  it("maps failed command_execution to failed activity without raw JSON", () => {
    const summary = activityFromEvents([
      codexJsonEvent({
        item: {
          command: "npm run build --prefix apps/desktop/frontend",
          exit_code: 1,
          stderr: "raw build output",
          type: "command_execution",
        },
        type: "item.completed",
      }),
    ]);

    expect(summary.status).toBe("failed");
    expect(summary.severity).toBe("warning");
    expect(summary.shortText).toBe(
      "Command failed: npm run build --prefix apps/desktop/frontend",
    );
    expect(summary.shortText).not.toContain("raw build output");
  });

  it("maps agent_message activity to preparing response", () => {
    const summary = activityFromEvents([
      codexJsonEvent({
        item: {
          text: "Final answer body should stay in the transcript path.",
          type: "agent_message",
        },
        type: "item.completed",
      }),
    ]);

    expect(summary).toMatchObject({
      latestTitle: "Preparing response",
      shortText: "Preparing response",
      status: "running",
      stepCount: 1,
    });
  });

  it("shows completed run activity with completed step count", () => {
    const summary = activityFromEvents([
      codexJsonEvent({ type: "thread.started" }),
      codexJsonEvent({ type: "turn.started" }),
      codexJsonEvent({
        item: { command: "git status", type: "command_execution" },
        type: "item.started",
      }),
      codexJsonEvent({
        item: {
          command: "git status",
          exit_code: 0,
          type: "command_execution",
        },
        type: "item.completed",
      }),
      codexJsonEvent({
        item: { text: "Done", type: "agent_message" },
        type: "item.completed",
      }),
      codexJsonEvent({ type: "turn.completed" }),
      directWorkEvent({
        eventKind: "completed",
        finalStatus: "completed",
        isFinal: true,
      }),
    ]);

    expect(summary.status).toBe("completed");
    expect(summary.severity).toBe("success");
    expect(summary.shortText).toBe("Completed");
    expect(summary.stepCount).toBe(6);
  });

  it("shows failed run activity with compact failure summary", () => {
    const summary = workspaceAgentActivitySummaryFromEvent(
      EMPTY_WORKSPACE_AGENT_ACTIVITY_SUMMARY,
      directWorkEvent({
        eventKind: "failed",
        errorMessage:
          "shell snapshot failed while reading environment variables that should not be exposed",
        finalStatus: "failed",
        isFinal: true,
      }),
      {
        failureReason:
          "shell snapshot failed while reading environment variables that should not be exposed",
      },
    );

    expect(summary).toMatchObject({
      severity: "error",
      shortText: "Codex environment error",
      status: "failed",
      stepCount: 0,
    });
  });
});

function activityFromEvents(events: DirectWorkStreamEvent[]) {
  return events.reduce<WorkspaceAgentActivitySummary>(
    (summary, event) => workspaceAgentActivitySummaryFromEvent(summary, event),
    EMPTY_WORKSPACE_AGENT_ACTIVITY_SUMMARY,
  );
}

function codexJsonEvent(payload: Record<string, unknown>): DirectWorkStreamEvent {
  return directWorkEvent({
    eventKind: "codex_json_event",
    line: JSON.stringify(payload),
    parsedCodexEventType:
      typeof payload.type === "string" ? payload.type : null,
  });
}

function directWorkEvent(
  overrides: Partial<DirectWorkStreamEvent> = {},
): DirectWorkStreamEvent {
  return {
    codexThreadId: null,
    elapsedMs: 0,
    errorMessage: null,
    eventKind: "stdout_line",
    exitCode: null,
    failedStage: null,
    finalStatus: null,
    isFinal: false,
    line: null,
    parsedCodexEventType: null,
    runId: "run-1",
    status: null,
    stderrPreview: null,
    text: null,
    widgetInstanceId: "widget-1",
    workbenchId: "workbench-1",
    workspaceId: "workspace-1",
    ...overrides,
  };
}

function knowledgeResult(index: number): KnowledgeDocumentSearchResult {
  const displayIndex = index + 1;

  return {
    chunkId: `chunk-${displayIndex}`,
    chunkIndex: index,
    documentTitle: `Doc ${displayIndex}`,
    knowledgeDocumentId: `doc-${displayIndex}`,
    score: 1,
    snippet: `Snippet ${displayIndex}`,
    sourceLabel: "source",
    scope: "workspace",
    tags: "",
  };
}
