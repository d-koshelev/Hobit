import { act } from "react";

import {
  createQueueHarness,
  flushControllerLoad,
  queueTask,
  renderQueueController,
} from "./useAgentQueueControllerTestHelpers";

describe("useAgentQueueController ordering", () => {
  it("moves tasks up, down, top, and bottom without starting execution", async () => {
    const harness = createQueueHarness([
      queueTask({
        createdAt: "2026-05-20T10:00:00.000Z",
        queueItemId: "queue-1",
        title: "First",
      }),
      queueTask({
        createdAt: "2026-05-20T10:01:00.000Z",
        queueItemId: "queue-2",
        title: "Second",
      }),
      queueTask({
        createdAt: "2026-05-20T10:02:00.000Z",
        queueItemId: "queue-3",
        title: "Third",
      }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    expect(hook.result.current.tasks.map((task) => task.queueItemId)).toEqual([
      "queue-1",
      "queue-2",
      "queue-3",
    ]);

    act(() => {
      hook.result.current.ordering.onMoveDown();
    });
    expect(hook.result.current.tasks.map((task) => task.queueItemId)).toEqual([
      "queue-2",
      "queue-1",
      "queue-3",
    ]);

    act(() => {
      hook.result.current.ordering.onMoveToBottom();
    });
    expect(hook.result.current.tasks.map((task) => task.queueItemId)).toEqual([
      "queue-2",
      "queue-3",
      "queue-1",
    ]);

    act(() => {
      hook.result.current.ordering.onMoveUp();
    });
    expect(hook.result.current.tasks.map((task) => task.queueItemId)).toEqual([
      "queue-2",
      "queue-1",
      "queue-3",
    ]);

    act(() => {
      hook.result.current.ordering.onMoveToTop();
    });
    expect(hook.result.current.tasks.map((task) => task.queueItemId)).toEqual([
      "queue-1",
      "queue-2",
      "queue-3",
    ]);
    expect(hook.result.current.foundation.pausedQueueTagIds.has("default")).toBe(
      true,
    );
    expect(harness.updateRequests).toHaveLength(0);
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });
});
