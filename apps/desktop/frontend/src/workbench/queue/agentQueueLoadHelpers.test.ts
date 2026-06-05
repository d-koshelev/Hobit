import type { SetStateAction } from "react";

import type { AgentQueueTaskRunLinkSummary } from "../../workspace/types";
import { refreshAgentQueueRunLinks } from "./agentQueueLoadHelpers";
import { queueRunLink } from "./useAgentQueueControllerTestHelpers";

type StateHarness<T> = {
  readonly changedUpdates: number;
  readonly current: T;
  set: (action: SetStateAction<T>) => void;
};

describe("agentQueueLoadHelpers", () => {
  it("keeps empty run metadata state stable when no queue item is selected", async () => {
    const latestRunLink = stateHarness<AgentQueueTaskRunLinkSummary | null>(
      null,
    );
    const runHistoryLinks = stateHarness<AgentQueueTaskRunLinkSummary[]>([]);
    const latestRunLinkError = stateHarness<string | null>(null);
    const isLatestRunLinkLoading = stateHarness<boolean>(false);

    await refreshAgentQueueRunLinks({
      queueItemId: null,
      setIsLatestRunLinkLoading: isLatestRunLinkLoading.set,
      setLatestRunLink: latestRunLink.set,
      setLatestRunLinkError: latestRunLinkError.set,
      setRunHistoryLinks: runHistoryLinks.set,
    });

    expect(latestRunLink.changedUpdates).toBe(0);
    expect(runHistoryLinks.changedUpdates).toBe(0);
    expect(latestRunLinkError.changedUpdates).toBe(0);
    expect(isLatestRunLinkLoading.changedUpdates).toBe(0);
  });

  it("keeps equivalent run metadata state stable across repeated refreshes", async () => {
    const existingLink = queueRunLink({ status: "completed" });
    const existingHistory = [existingLink];
    const latestRunLink =
      stateHarness<AgentQueueTaskRunLinkSummary | null>(existingLink);
    const runHistoryLinks =
      stateHarness<AgentQueueTaskRunLinkSummary[]>(existingHistory);
    const latestRunLinkError = stateHarness<string | null>(null);
    const isLatestRunLinkLoading = stateHarness<boolean>(false);

    await refreshAgentQueueRunLinks({
      onListAgentQueueTaskRunLinks: async () => [{ ...existingLink }],
      options: { silent: true },
      queueItemId: existingLink.queueTaskId,
      setIsLatestRunLinkLoading: isLatestRunLinkLoading.set,
      setLatestRunLink: latestRunLink.set,
      setLatestRunLinkError: latestRunLinkError.set,
      setRunHistoryLinks: runHistoryLinks.set,
    });

    expect(latestRunLink.current).toBe(existingLink);
    expect(runHistoryLinks.current).toBe(existingHistory);
    expect(latestRunLink.changedUpdates).toBe(0);
    expect(runHistoryLinks.changedUpdates).toBe(0);
  });
});

function stateHarness<T>(initialValue: T): StateHarness<T> {
  let current = initialValue;
  let changedUpdates = 0;

  return {
    get changedUpdates() {
      return changedUpdates;
    },
    get current() {
      return current;
    },
    set(action: SetStateAction<T>) {
      const next =
        typeof action === "function"
          ? (action as (current: T) => T)(current)
          : action;

      if (!Object.is(current, next)) {
        changedUpdates += 1;
      }

      current = next;
    },
  };
}
