import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SkillLibraryWidget } from "./SkillLibraryWidget";
import type { WidgetDefinition, WidgetInstance } from "./types";
import type { Skill } from "../workspace/types";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root && container) {
    act(() => {
      root?.unmount();
    });
    container.remove();
  }
  root = null;
  container = null;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("SkillLibraryWidget", () => {
  it("renders the empty workspace-local safety state", async () => {
    renderWidget({
      onListSkills: vi.fn(async () => []),
      onGetSkill: vi.fn(),
    });

    await flush();

    expect(document.body.textContent).toContain("No skills yet.");
    expect(document.body.textContent).toContain("Workspace-local.");
    expect(document.body.textContent).toContain(
      "Not sent to Coordinator automatically.",
    );
    expect(document.body.textContent).toContain(
      "Skills are not sent to Coordinator unless explicitly attached.",
    );
  });

  it("attaches the selected Skill to Coordinator as visible allowed fields only", async () => {
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

    expect(attachToCoordinator).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "Shares this visible Skill with Coordinator. Does not send automatically.",
    );

    await clickButton("Attach to Coordinator");

    expect(attachToCoordinator).toHaveBeenCalledTimes(1);
    const request = attachToCoordinator.mock.calls[0][0];
    expect(request.sourceLabel).toBe("Skill Library / Skill");
    expect(request.contextText).toContain("Skill Library Skill");
    expect(request.contextText).toContain("Title: Frontend review");
    expect(request.contextText).toContain(
      "When to use:\nBefore merging frontend changes",
    );
    expect(request.contextText).toContain("Prerequisites:\nReviewed working tree");
    expect(request.contextText).toContain("Steps:\nRun typecheck\nRun focused tests");
    expect(request.contextText).toContain("Validation:\nnpm test passes");
    expect(request.contextText).toContain("Risks:\nValidation may be slow");
    expect(request.contextText).toContain("Tags: frontend, review");
    expect(request.contextText).toContain("Review status: Reviewed");
    expect(request.contextText).not.toMatch(
      /skill_visible|workspace_1|createdAt|updatedAt|created_at|updated_at/i,
    );
    expect(document.body.textContent).toContain(
      "Skill attached to Coordinator as visible context.",
    );
  });

  it("creates, edits, saves, and deletes an operator-authored skill", async () => {
    let skills: Skill[] = [];
    const createSkill = vi.fn(async (request) => {
      const skill = skillFixture({
        ...request,
        skillId: "skill_created",
      });
      skills = [skill];
      return skill;
    });
    const updateSkill = vi.fn(async (request) => {
      const skill = skillFixture({
        ...request,
        skillId: request.skillId,
      });
      skills = [skill];
      return skill;
    });
    const deleteSkill = vi.fn(async () => {
      skills = [];
      return true;
    });

    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderWidget({
      onCreateSkill: createSkill,
      onDeleteSkill: deleteSkill,
      onGetSkill: vi.fn(async (skillId) =>
        skills.find((skill) => skill.skillId === skillId) ?? null,
      ),
      onListSkills: vi.fn(async () => skills),
      onUpdateSkill: updateSkill,
    });

    await flush();
    await changeInput('input[placeholder="Untitled skill"]', "Deploy review");
    await changeTextarea(0, "Before a production deploy");
    await changeTextarea(2, "Run validation\nReview changed files");
    await changeInput('input[placeholder="review, deploy"]', "deploy, review");
    await clickButton("Save skill");

    expect(createSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewStatus: "draft",
        steps: "Run validation\nReview changed files",
        tags: "deploy, review",
        title: "Deploy review",
        whenToUse: "Before a production deploy",
      }),
    );
    expect(document.body.textContent).toContain("Deploy review");

    await changeInput('input[placeholder="Untitled skill"]', "Reviewed deploy");
    await changeSelect("reviewed");
    await clickButton("Save skill");

    expect(updateSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewStatus: "reviewed",
        skillId: "skill_created",
        title: "Reviewed deploy",
      }),
    );

    await clickButton("Delete");

    expect(deleteSkill).toHaveBeenCalledWith({ skillId: "skill_created" });
    expect(document.body.textContent).toContain("No skills yet.");
  });
});

function renderWidget(
  overrides: Partial<Parameters<typeof SkillLibraryWidget>[0]> = {},
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <SkillLibraryWidget
        config={{}}
        definition={definition()}
        instance={instance()}
        onCreateSkill={vi.fn(async (request) => skillFixture(request))}
        onDeleteSkill={vi.fn(async () => true)}
        onGetSkill={vi.fn(async () => null)}
        onListSkills={vi.fn(async () => [])}
        onUpdateSkill={vi.fn(async (request) => skillFixture(request))}
        title="Skill Library"
        {...overrides}
      />,
    );
  });
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function clickButton(text: string) {
  await act(async () => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (candidate) => candidate.textContent === text,
    );
    if (!button) {
      throw new Error(`Button not found: ${text}`);
    }
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function changeInput(selector: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(selector);
  if (!input) {
    throw new Error(`Input not found: ${selector}`);
  }

  await act(async () => {
    setNativeValue(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function changeTextarea(index: number, value: string) {
  const textarea = document.querySelectorAll("textarea")[index];
  if (!textarea) {
    throw new Error(`Textarea not found: ${index}`);
  }

  await act(async () => {
    setNativeValue(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function changeSelect(value: string) {
  const select = document.querySelector("select");
  if (!select) {
    throw new Error("Review status select not found.");
  }

  await act(async () => {
    setNativeValue(select, value);
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function setNativeValue(
  field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  value: string,
) {
  const descriptor = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(field),
    "value",
  );
  descriptor?.set?.call(field, value);
}

function skillFixture(
  overrides: Partial<Skill> & {
    reviewStatus?: Skill["reviewStatus"];
    title?: string;
  } = {},
): Skill {
  return {
    createdAt: "2026-05-24T00:00:00Z",
    prerequisites: "",
    reviewStatus: "draft",
    risks: "",
    skillId: "skill_1",
    steps: "",
    tags: "",
    title: "Skill",
    updatedAt: "2026-05-24T00:00:00Z",
    validation: "",
    whenToUse: "",
    workspaceId: "workspace_1",
    ...overrides,
  };
}

function definition(): WidgetDefinition {
  return {
    category: "knowledge",
    componentKey: "skill-library-widget",
    defaultConfig: {},
    defaultTitle: "Skill Library",
    description: "Skill Library",
    id: "skill-library",
    title: "Skill Library",
  };
}

function instance(): WidgetInstance {
  return {
    config: {},
    definitionId: "skill-library",
    id: "skill_widget",
    layout: {
      area: "main",
      height: 720,
      mode: "docked",
      order: 0,
      width: 760,
      x: 0,
      y: 0,
    },
    state: {},
    title: "Skill Library",
    visible: true,
  };
}
