import { describe, expect, it } from "vitest";

import type { GenerateCoordinatorProviderResponse } from "../workspace/types";
import {
  errorToMessage,
  providerResponseAllowsCatalogDrafts,
} from "./workspaceAgentProviderGuards";

describe("workspaceAgentProviderGuards", () => {
  it("allows catalog drafts for completed provider responses with empty allowedTools and safety flags", () => {
    expect(providerResponseAllowsCatalogDrafts(providerResponse())).toBe(true);
  });

  it("rejects catalog drafts for unsupported or unsafe provider responses", () => {
    expect(
      providerResponseAllowsCatalogDrafts(
        providerResponse({ providerStatus: "unsupported" }),
      ),
    ).toBe(false);
    expect(
      providerResponseAllowsCatalogDrafts(
        providerResponse({ allowedTools: ["terminal"] }),
      ),
    ).toBe(false);
    expect(
      providerResponseAllowsCatalogDrafts(
        providerResponse({ noHiddenContextUsed: false }),
      ),
    ).toBe(false);
  });

  it("preserves empty allowedTools behavior for catalog draft eligibility", () => {
    expect(
      providerResponseAllowsCatalogDrafts(
        providerResponse({ allowedTools: [] }),
      ),
    ).toBe(true);
    expect(
      providerResponseAllowsCatalogDrafts(
        providerResponse({ allowedTools: ["queue.create"] }),
      ),
    ).toBe(false);
  });

  it("returns Error messages and falls back for unknown thrown values", () => {
    expect(errorToMessage(new Error("Provider request failed."), "Fallback."))
      .toBe("Provider request failed.");
    expect(errorToMessage("failed", "Fallback.")).toBe("Fallback.");
    expect(errorToMessage(null, "Fallback.")).toBe("Fallback.");
  });
});

function providerResponse(
  overrides: Partial<GenerateCoordinatorProviderResponse> = {},
): GenerateCoordinatorProviderResponse {
  return {
    allowedTools: [],
    assistantText: "Provider answer.",
    noHiddenContextUsed: true,
    noMutationsPerformed: true,
    noToolsExecuted: true,
    proposalDrafts: [],
    providerError: null,
    providerKind: "mock-local",
    providerStatus: "completed",
    requestId: "provider-test-request",
    visibleContextMessageCount: 1,
    visibleProposalDraftCount: 0,
    ...overrides,
  };
}
