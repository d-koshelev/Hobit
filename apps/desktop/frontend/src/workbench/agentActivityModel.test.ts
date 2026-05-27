import { describe, expect, it } from "vitest";

import type { DirectWorkStreamEvent } from "../workspace/types";
import {
  agentActivityEventFromDirectWorkStreamEvent,
  mergeAgentActivityEvents,
} from "./agentActivityModel";

describe("agentActivityModel", () => {
  it("maps Direct Work lifecycle events to readable activity", () => {
    expect(activityFromEvent(directWorkEvent({ eventKind: "started" }))).toMatchObject({
      status: "running",
      summary: "Direct Work accepted.",
      title: "Started run",
    });
    expect(
      activityFromEvent(
        codexJsonEvent({
          type: "thread.started",
        }),
      ),
    ).toMatchObject({
      summary: "Codex thread started.",
      title: "Started thread",
    });
    expect(activityFromEvent(codexJsonEvent({ type: "turn.started" })))
      .toMatchObject({
        summary: "Agent started working on the prompt.",
        title: "Started turn",
      });
    expect(activityFromEvent(codexJsonEvent({ type: "turn.completed" })))
      .toMatchObject({
        severity: "success",
        status: "completed",
        summary: "Agent turn completed.",
        title: "Completed turn",
      });
    expect(
      activityFromEvent(
        directWorkEvent({
          eventKind: "completed",
          finalStatus: "completed",
          isFinal: true,
        }),
      ),
    ).toMatchObject({
      severity: "success",
      status: "completed",
      title: "Completed run",
    });
  });

  it("maps command start, finish, and failure without raw stdout in normal text", () => {
    expect(
      activityFromEvent(
        codexJsonEvent({
          item: {
            args: ["status", "--short"],
            command: "git",
            type: "command_execution",
          },
          type: "item.started",
        }),
      ),
    ).toMatchObject({
      command: "git status --short",
      summary: "Running git status --short",
      status: "running",
      title: "Ran command",
    });

    expect(
      activityFromEvent(
        codexJsonEvent({
          item: {
            command: "cargo check",
            exit_code: 0,
            type: "command_execution",
          },
          type: "item.completed",
        }),
      ),
    ).toMatchObject({
      command: "cargo check",
      severity: "success",
      status: "completed",
      summary: "cargo check finished.",
      title: "Command finished",
    });

    const failed = activityFromEvent(
      codexJsonEvent({
        item: {
          command: "npm run build",
          exit_code: 1,
          stdout: "raw stdout should not be in summary",
          type: "command_execution",
        },
        type: "item.completed",
      }),
    );

    expect(failed).toMatchObject({
      command: "npm run build",
      outputPreview: "raw stdout should not be in summary",
      severity: "error",
      status: "failed",
      summary: "npm run build failed.",
      title: "Command failed",
    });
    expect(failed?.summary).not.toContain("raw stdout");
    expect(failed?.rawPreview).toContain("raw stdout should not be in summary");
  });

  it("merges events by id and keeps chronological order", () => {
    const first = activityFromEvent(directWorkEvent({ runId: "run-1" }), 1);
    const second = activityFromEvent(
      directWorkEvent({ elapsedMs: 10, runId: "run-2" }),
      2,
    );

    expect(mergeAgentActivityEvents([], [second!, first!])).toEqual([
      first,
      second,
    ]);
    expect(
      mergeAgentActivityEvents([first!], [{ ...first!, summary: "Updated." }]),
    ).toEqual([{ ...first!, summary: "Updated." }]);
  });
});

function activityFromEvent(
  event: DirectWorkStreamEvent,
  receivedAtMs = 1_000,
) {
  return agentActivityEventFromDirectWorkStreamEvent({
    event,
    receivedAtMs,
    sourceKind: "workspace-agent",
    sourceLabel: "Workspace Agent",
  });
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
    eventKind: "started",
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
