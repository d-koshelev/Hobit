import { describe, expect, it } from "vitest";

import {
  computeDuplicateQueueViewRepair,
  identifyQueueViews,
  selectCanonicalQueueView,
} from "../workspaceSingletonWidgets";

type TestWidget = {
  createdAt?: string | null;
  dockX?: number | null;
  dockY?: number | null;
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

  it("restores one canonical Queue view when all persisted duplicates are hidden", () => {
    const laterHiddenDuplicate = widget({
      definitionId: "agent-queue",
      id: "queue_b",
      isVisible: false,
      order: 2,
    });
    const earlierHiddenCanonical = widget({
      definitionId: "agent-queue",
      id: "queue_a",
      isVisible: false,
      order: 1,
    });

    const repair = computeDuplicateQueueViewRepair([
      laterHiddenDuplicate,
      earlierHiddenCanonical,
    ]);
    const visibleQueueViews = repair.repairedWidgets.filter(
      (candidate) =>
        candidate.definitionId === "agent-queue" && candidate.isVisible,
    );

    expect(repair.canonicalQueueView).toBe(earlierHiddenCanonical);
    expect(repair.duplicateQueueViewIds).toEqual(["queue_b"]);
    expect(visibleQueueViews).toEqual([
      expect.objectContaining({ id: "queue_a" }),
    ]);
  });

  it("selects the canonical Queue view with stable deterministic ordering", () => {
    const hiddenWithEarlierLayout = widget({
      definitionId: "agent-queue",
      id: "queue_hidden",
      isVisible: false,
      order: 0,
    });
    const laterCreated = widget({
      definitionId: "agent-queue",
      id: "queue_b",
      createdAt: "2026-06-14T10:02:00.000Z",
      dockX: 0,
      dockY: 0,
      order: 2,
    });
    const earlierCreated = widget({
      definitionId: "agent-queue",
      id: "queue_c",
      createdAt: "2026-06-14T10:01:00.000Z",
      dockX: 10,
      dockY: 10,
      order: 1,
    });

    expect(
      selectCanonicalQueueView([
        hiddenWithEarlierLayout,
        laterCreated,
        earlierCreated,
      ]),
    ).toBe(earlierCreated);
    expect(
      selectCanonicalQueueView([
        earlierCreated,
        hiddenWithEarlierLayout,
        laterCreated,
      ]),
    ).toBe(earlierCreated);
  });

  it("uses layout order, dock geometry, and id as stable fallback tiebreakers", () => {
    const laterLayout = widget({
      definitionId: "agent-queue",
      id: "queue_b",
      dockX: 0,
      dockY: 0,
      order: 2,
    });
    const earlierLayout = widget({
      definitionId: "agent-queue",
      id: "queue_c",
      dockX: 10,
      dockY: 10,
      order: 1,
    });
    const idTieBreaker = widget({
      definitionId: "agent-queue",
      id: "queue_a",
      dockX: 10,
      dockY: 10,
      order: 1,
    });

    expect(
      selectCanonicalQueueView([laterLayout, earlierLayout, idTieBreaker]),
    ).toBe(idTieBreaker);
    expect(
      selectCanonicalQueueView([idTieBreaker, laterLayout, earlierLayout]),
    ).toBe(idTieBreaker);
  });

  it("identifies duplicate Queue views without rewriting models that lack a visibility field", () => {
    const widgets = [
      viewOnlyWidget({ definitionId: "agent-queue", id: "queue_a" }),
      viewOnlyWidget({ definitionId: "agent-queue", id: "queue_b" }),
    ];
    const repair = computeDuplicateQueueViewRepair(widgets);

    expect(repair.repairKind).toBe("identify-only");
    expect(repair.duplicateQueueViewIds).toEqual(["queue_b"]);
    expect(repair.repairedWidgets).toEqual(widgets);
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

  it("does not treat compatibility or malformed Queue-looking ids as Queue views", () => {
    const queue = widget({ definitionId: "agent-queue", id: "queue_1" });
    const queueV2Smoke = widget({
      definitionId: "queue-v2",
      id: "queue_v2_smoke",
    });
    const agentRun = widget({
      definitionId: "agent-run",
      id: "agent_run_1",
    });

    const repair = computeDuplicateQueueViewRepair([
      queue,
      queueV2Smoke,
      agentRun,
    ]);

    expect(repair.queueViews).toEqual([queue]);
    expect(repair.repairKind).toBe("none");
    expect(repair.repairedWidgets).toEqual([queue, queueV2Smoke, agentRun]);
  });
});

function widget({
  createdAt,
  definitionId,
  dockX,
  dockY,
  id,
  isVisible = true,
  order = 0,
}: {
  createdAt?: string | null;
  definitionId: string;
  dockX?: number | null;
  dockY?: number | null;
  id: string;
  isVisible?: boolean;
  order?: number;
}): TestWidget {
  return {
    ...(createdAt !== undefined ? { createdAt } : {}),
    definitionId,
    ...(dockX !== undefined ? { dockX } : {}),
    ...(dockY !== undefined ? { dockY } : {}),
    id,
    isVisible,
    layout: { order },
    title: id,
  };
}

function viewOnlyWidget({
  definitionId,
  id,
}: {
  definitionId: string;
  id: string;
}) {
  return {
    definitionId,
    id,
    title: id,
  };
}
