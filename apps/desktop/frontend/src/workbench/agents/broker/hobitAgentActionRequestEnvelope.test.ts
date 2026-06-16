// @ts-expect-error Node types are intentionally absent from the frontend tsconfig; this test reads source in Vitest only.
import { readFileSync } from "fs";

import { describe, expect, it } from "vitest";

import {
  createHobitAgentCapabilityRegistry,
  findCapability,
  type HobitAgentCapability,
} from "../capabilities";
import {
  createHobitAgentActionRequestFromEnvelope,
  HOBIT_AGENT_ACTION_REQUEST_ENVELOPE_TYPE,
  readHobitAgentActionRequestEnvelope,
} from "./hobitAgentActionRequestEnvelope";

describe("hobitAgentActionRequestEnvelope", () => {
  it("parses a valid structured Hobit action request envelope", () => {
    const result = readHobitAgentActionRequestEnvelope(
      JSON.stringify({
        capabilityId: "queue.createItems",
        dryRun: false,
        input: {
          items: [{ prompt: "Implement task A.", title: "Task A" }],
        },
        reason: "Create reviewed Queue work.",
        requestId: "request-queue-create",
        type: HOBIT_AGENT_ACTION_REQUEST_ENVELOPE_TYPE,
      }),
    );

    expect(result).toMatchObject({
      envelope: {
        capabilityId: "queue.createItems",
        dryRun: false,
        reason: "Create reviewed Queue work.",
        requestId: "request-queue-create",
        type: HOBIT_AGENT_ACTION_REQUEST_ENVELOPE_TYPE,
      },
      source: "direct_json",
      status: "valid",
    });
  });

  it("parses a structured envelope from a fenced JSON block", () => {
    const result = readHobitAgentActionRequestEnvelope(
      [
        "I will request the app capability.",
        "```json",
        JSON.stringify({
          capabilityId: "queue.preparePromptPackPreview",
          dryRun: true,
          input: { sourceText: "{}" },
          type: HOBIT_AGENT_ACTION_REQUEST_ENVELOPE_TYPE,
        }),
        "```",
      ].join("\n"),
    );

    expect(result).toMatchObject({
      envelope: {
        capabilityId: "queue.preparePromptPackPreview",
        dryRun: true,
      },
      source: "fenced_json",
      status: "valid",
    });
  });

  it("returns invalid for malformed structured JSON", () => {
    const result = readHobitAgentActionRequestEnvelope(
      [
        "```hobit-action-request",
        '{"type":"hobit.action.request","capabilityId":',
        "```",
      ].join("\n"),
    );

    expect(result).toMatchObject({
      reasons: ["Envelope JSON is invalid."],
      status: "invalid",
    });
  });

  it("returns invalid for an unknown structured envelope type", () => {
    const result = readHobitAgentActionRequestEnvelope(
      JSON.stringify({
        capabilityId: "queue.createItems",
        dryRun: false,
        input: { items: [] },
        type: "hobit.action.unknown",
      }),
    );

    expect(result).toMatchObject({
      reasons: ["Envelope type must be hobit.action.request."],
      status: "invalid",
    });
  });

  it("ignores normal assistant prose without a valid envelope", () => {
    const result = readHobitAgentActionRequestEnvelope(
      "I can break this into Queue tasks, but no app action is being requested here.",
    );

    expect(result).toEqual({ status: "none" });
  });

  it("ignores unrelated structured JSON blocks", () => {
    const result = readHobitAgentActionRequestEnvelope(
      [
        "Here is a visible draft card.",
        "```json",
        JSON.stringify({
          title: "Codex deploy skill",
          type: "catalog.skill.create",
        }),
        "```",
      ].join("\n"),
    );

    expect(result).toEqual({ status: "none" });
  });

  it("does not treat user prompt phrases as action requests", () => {
    const result = readHobitAgentActionRequestEnvelope(
      "User request: add these tasks to Queue and create Queue items.",
    );

    expect(result).toEqual({ status: "none" });
  });

  it("creates a typed broker request from a valid envelope without executing it", () => {
    const envelope = {
      capabilityId: "queue.createItems",
      confirmationToken: null,
      dryRun: false,
      input: { items: [{ prompt: "Prompt", title: "Title" }] },
      reason: "Create Queue work.",
      requestId: "queue-request-1",
      type: HOBIT_AGENT_ACTION_REQUEST_ENVELOPE_TYPE,
    } as const;
    const request = createHobitAgentActionRequestFromEnvelope({
      agentId: "workspace-agent:coordinator",
      createdAt: "2026-06-15T10:00:00.000Z",
      envelope,
    });

    expect(request).toMatchObject({
      agentId: "workspace-agent:coordinator",
      agentRoleId: "workspace_agent",
      capabilityId: "queue.createItems",
      dryRun: false,
      input: envelope.input,
      requestId: "queue-request-1",
    });
  });

  it("parses Queue capability manifest action-request examples", () => {
    const registry = createHobitAgentCapabilityRegistry();

    for (const capabilityId of ["queue.createItem", "queue.createItems"]) {
      const capability = requiredCapability(registry, capabilityId);
      const example = requiredMutationExample(capability);
      const result = readHobitAgentActionRequestEnvelope(
        JSON.stringify(example.exampleActionRequest),
      );

      expect(result).toMatchObject({
        envelope: {
          capabilityId,
          dryRun: false,
          type: HOBIT_AGENT_ACTION_REQUEST_ENVELOPE_TYPE,
        },
        status: "valid",
      });
    }
  });

  it("does not implement product-intent regex routing", () => {
    const source = frontendSource(
      "workbench/agents/broker/hobitAgentActionRequestEnvelope.ts",
    );

    expect(source).not.toContain("new RegExp");
    expect(source).not.toContain(".match(");
    expect(source).not.toContain("classify");
    expect(source).not.toContain("Queue intent detected");
    expect(source).not.toContain(["user text", " -> ", "product action"].join(""));
  });
});

function frontendSource(path: string) {
  const cwd = (
    globalThis as unknown as { process: { cwd: () => string } }
  ).process.cwd();

  return readFileSync(`${cwd}/src/${path}`, "utf8");
}

function requiredCapability(
  registry: ReturnType<typeof createHobitAgentCapabilityRegistry>,
  capabilityId: string,
) {
  const capability = findCapability(registry, capabilityId);
  if (!capability) {
    throw new Error(`Missing capability ${capabilityId}`);
  }
  return capability;
}

function requiredMutationExample(capability: HobitAgentCapability) {
  const example = capability.examples?.find(
    (candidate) => !candidate.exampleActionRequest.dryRun,
  );

  if (!example) {
    throw new Error(`Missing mutation example for ${capability.id}`);
  }

  return example;
}
