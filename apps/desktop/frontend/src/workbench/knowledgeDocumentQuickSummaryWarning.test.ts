import { describe, expect, it } from "vitest";

import { knowledgeDocumentQuickSummaryWarning } from "./knowledgeDocumentQuickSummaryWarning";

describe("knowledgeDocumentQuickSummaryWarning", () => {
  it("warns active searchable Knowledge when quick summary is missing", () => {
    expect(
      knowledgeDocumentQuickSummaryWarning({
        enabled: true,
        lifecycleStatus: "active",
        quickSummary: "",
      }),
    ).toContain("Summary missing");
  });

  it("keeps draft Knowledge warning-bearing without requiring a summary", () => {
    expect(
      knowledgeDocumentQuickSummaryWarning({
        enabled: true,
        lifecycleStatus: "draft",
        quickSummary: "",
      }),
    ).toContain("Draft Knowledge");
  });

  it("does not warn when quick summary is present", () => {
    expect(
      knowledgeDocumentQuickSummaryWarning({
        enabled: true,
        lifecycleStatus: "active",
        quickSummary: "Use this during focused Knowledge review.",
      }),
    ).toBeNull();
  });
});
