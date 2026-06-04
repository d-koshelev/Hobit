import { describe, expect, it, vi } from "vitest";

import {
  buttonWithText,
  changeTextarea,
  clickButton,
  flush,
  renderWidget,
  skillFixture,
} from "./SkillLibraryWidget.test-helpers";

describe("SkillLibraryWidget Workspace Agent Skill attach", () => {
  it("attaches the selected Skill to Workspace Agent as visible allowed fields only", async () => {
    const skill = skillFixture({
      prerequisites: "Reviewed working tree",
      reviewStatus: "reviewed",
      risks: "Validation may be slow",
      skillId: "skill_visible",
      steps: "Run typecheck\nRun focused tests",
      tags: "frontend, review",
      title: "Frontend review",
      validation: "npm test passes",
      whenToUse: "Before merging frontend changes",
    });
    const attachToCoordinator = vi.fn();

    renderWidget({
      onAttachContextToCoordinator: attachToCoordinator,
      onGetSkill: vi.fn(async () => skill),
      onListSkills: vi.fn(async () => [skill]),
    });

    await flush();
    await clickButton("Skills");

    expect(attachToCoordinator).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "Attach uses the last saved Skill. Save edits before attaching. Does not send automatically.",
    );

    await clickButton("Attach to Workspace Agent");

    expect(attachToCoordinator).toHaveBeenCalledTimes(1);
    const request = attachToCoordinator.mock.calls[0][0];
    expect(request.sourceLabel).toBe("Skill Library / Skill");
    expect(request.contextText).toContain("Skill Library Skill");
    expect(request.contextText).toContain("Title: Frontend review");
    expect(request.contextText).toContain(
      "When to use:\nBefore merging frontend changes",
    );
    expect(request.contextText).toContain(
      "Prerequisites:\nReviewed working tree",
    );
    expect(request.contextText).toContain(
      "Steps:\nRun typecheck\nRun focused tests",
    );
    expect(request.contextText).toContain("Validation:\nnpm test passes");
    expect(request.contextText).toContain("Risks:\nValidation may be slow");
    expect(request.contextText).toContain("Tags: frontend, review");
    expect(request.contextText).toContain("Review status: Reviewed");
    expect(request.contextText).not.toMatch(
      /skill_visible|workspace_1|createdAt|updatedAt|created_at|updated_at/i,
    );
    expect(document.body.textContent).toContain(
      "Skill attached to Workspace Agent as visible context.",
    );
  });

  it("does not show Attach to Workspace Agent when Workspace Agent is not visible", async () => {
    const skill = skillFixture({
      skillId: "skill_saved",
      title: "Saved Skill",
      whenToUse: "Use from the Skill Library only",
    });

    renderWidget({
      onGetSkill: vi.fn(async () => skill),
      onListSkills: vi.fn(async () => [skill]),
    });

    await flush();
    await clickButton("Skills");

    expect(buttonWithText("Attach to Workspace Agent")).toBeUndefined();
    expect(document.body.textContent).toContain(
      "Add Workspace Agent to attach saved Skills as visible context.",
    );
  });

  it("attaches only the selected saved Skill after unsaved edits are saved", async () => {
    const attachToCoordinator = vi.fn();
    let skill = skillFixture({
      skillId: "skill_saved",
      steps: "Saved step",
      title: "Saved Skill",
    });
    const updateSkill = vi.fn(async (request) => {
      skill = skillFixture({
        ...request,
        skillId: request.skillId,
      });
      return skill;
    });

    renderWidget({
      onAttachContextToCoordinator: attachToCoordinator,
      onGetSkill: vi.fn(async () => skill),
      onListSkills: vi.fn(async () => [skill]),
      onUpdateSkill: updateSkill,
    });

    await flush();
    await clickButton("Skills");
    await changeTextarea(2, "Unsaved edited step");

    const attachButton = buttonWithText("Attach to Workspace Agent");
    expect(attachButton).toBeDefined();
    expect(attachButton?.disabled).toBe(true);
    expect(attachToCoordinator).not.toHaveBeenCalled();

    await clickButton("Save skill");
    await clickButton("Attach to Workspace Agent");

    expect(attachToCoordinator).toHaveBeenCalledTimes(1);
    const request = attachToCoordinator.mock.calls[0][0];
    expect(request.contextText).toContain("Steps:\nUnsaved edited step");
    expect(request.contextText).not.toContain("Saved step");
  });
});
