import { describe, expect, it } from "vitest";

import type {
  DirectWorkStreamEvent,
  KnowledgeDocumentSearchResult,
} from "../workspace/types";
import {
  DIRECT_WORK_DIRECTORY_ACCESS_DENIED_MESSAGE,
  DIRECT_WORK_FALLBACK_FAILURE_MESSAGE,
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
  type CodexThreadScope,
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
    expect(prompt).toContain("[Doc: Doc 1, chunk 1]\nSnippet 1");
    expect(prompt).toContain("[Doc: Doc 5, chunk 5]\nSnippet 5");
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
});

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
    tags: "",
  };
}
