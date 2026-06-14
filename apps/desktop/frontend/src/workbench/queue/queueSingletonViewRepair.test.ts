import { describe, expect, it } from "vitest";

import {
  computeDuplicateQueueViewRepair,
  identifyQueueViews,
  selectCanonicalQueueView,
} from "./queueSingletonViewRepair";

type TestWidget = {
  definitionId: string;
  id: string;
  isVisible: boolean;
  layout?: {
    order?: number;
  };
  title: string;
};

describe("Queue singleton view repair", () => {
  it("does not repair when no Queue views exist", () => {
    const widgets = [widget({ definitionId: "notes", id: "notes_1" })];
    const repair = computeDuplicateQueueViewRepair(widgets);

    expect(identifyQueueViews(widgets)).toEqual([]);
    expect(selectCanonicalQueueView(widgets)).toBeNull();
    expect(repair).toMatchObject({
      canonicalQueueView: null,
      duplicateQueueViewIds: [],
      duplicateQueueViews: [],
      repairKind: "none",
    });
    expect(repair.repairedWidgets[0]).toBe(widgets[0]);
  });

  it("does not repair when exactly one Queue view exists", () => {
    const queue = widget({ definitionId: "agent-queue", id: "queue_1" });
    const widgets = [widget({ definitionId: "notes", id: "notes_1" }), queue];
    const repair = computeDuplicateQueueViewRepair(widgets);

    expect(identifyQueueViews(widgets)).toEqual([queue]);
    expect(selectCanonicalQueueView(widgets)).toBe(queue);
    expect(repair).toMatchObject({
      canonicalQueueView: queue,
      duplicateQueueViewIds: [],
      duplicateQueueViews: [],
      repairKind: "none",
    });
  });

  it("keeps one canonical Queue view and identifies duplicates", () => {
    const canonical = widget({
      definitionId: "agent-queue",
      id: "queue_a",
      order: 1,
    });
    const duplicate = widget({
      definitionId: "agent-queue",
      id: "queue_b",
      order: 2,
    });
    const repair = computeDuplicateQueueViewRepair([canonical, duplicate]);

    expect(repair.canonicalQueueView).toBe(canonical);
    expect(repair.duplicateQueueViews).toEqual([duplicate]);
    expect(repair.duplicateQueueViewIds).toEqual(["queue_b"]);
    expect(repair.repairKind).toBe("hide-duplicates");
    expect(repair.repairedWidgets).toEqual([
      canonical,
      expect.objectContaining({ id: "queue_b", isVisible: false }),
    ]);
  });

  it("selects the canonical Queue view with stable deterministic ordering", () => {
    const laterLayout = widget({
      definitionId: "agent-queue",
      id: "queue_b",
      order: 2,
    });
    const earlierLayout = widget({
      definitionId: "agent-queue",
      id: "queue_c",
      order: 1,
    });
    const idTieBreaker = widget({
      definitionId: "agent-queue",
      id: "queue_a",
      order: 1,
    });

    expect(
      selectCanonicalQueueView([laterLayout, earlierLayout, idTieBreaker]),
    ).toBe(idTieBreaker);
    expect(
      selectCanonicalQueueView([idTieBreaker, laterLayout, earlierLayout]),
    ).toBe(idTieBreaker);
  });

  it("does not touch Queue task domain data fixtures during view repair", () => {
    const queueDomainData = {
      tasks: [
        {
          prompt: "Keep this task data",
          queueItemId: "task_1",
          status: "queued",
        },
      ],
    };
    const before = structuredClone(queueDomainData);

    computeDuplicateQueueViewRepair([
      widget({ definitionId: "agent-queue", id: "queue_1" }),
      widget({ definitionId: "agent-queue", id: "queue_2" }),
    ]);

    expect(queueDomainData).toEqual(before);
  });

  it("leaves non-Queue widgets unaffected while hiding duplicate Queue views", () => {
    const notes = widget({ definitionId: "notes", id: "notes_1" });
    const agent = widget({
      definitionId: "interactive-agent",
      id: "agent_1",
    });
    const duplicate = widget({ definitionId: "agent-queue", id: "queue_2" });

    const repair = computeDuplicateQueueViewRepair([
      widget({ definitionId: "agent-queue", id: "queue_1" }),
      notes,
      duplicate,
      agent,
    ]);

    expect(repair.repairedWidgets[1]).toBe(notes);
    expect(repair.repairedWidgets[3]).toBe(agent);
    expect(repair.repairedWidgets[2]).toEqual(
      expect.objectContaining({ id: "queue_2", isVisible: false }),
    );
  });
});

function widget({
  definitionId,
  id,
  isVisible = true,
  order = 0,
}: {
  definitionId: string;
  id: string;
  isVisible?: boolean;
  order?: number;
}): TestWidget {
  return {
    definitionId,
    id,
    isVisible,
    layout: { order },
    title: id,
  };
}
