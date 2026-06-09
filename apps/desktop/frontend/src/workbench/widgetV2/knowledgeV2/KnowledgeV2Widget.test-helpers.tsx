import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { expect } from "vitest";

import type {
  KnowledgeDocument,
  KnowledgeDraftReviewDecision,
} from "../../../workspace/types/knowledgeDocuments";
import type { Skill } from "../../../workspace/types/skills";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

export function cleanupKnowledgeV2WidgetTestDom() {
  if (root && container) {
    act(() => {
      root?.unmount();
    });
    container.remove();
  }
  root = null;
  container = null;
  document.body.innerHTML = "";
}

export async function render(element: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(element);
  });
}

export async function clickButton(textContent: string) {
  const button = buttonWithText(textContent);
  expect(button).not.toBeNull();
  await act(async () => {
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

export async function clickButtonByLabel(label: string) {
  const button = buttonByLabel(label);
  expect(button).not.toBeNull();
  await act(async () => {
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

export async function clickButtonInRegion(
  regionLabel: string,
  textContent: string,
) {
  const region = regionByName(regionLabel);
  const button =
    region
      ? Array.from(region.querySelectorAll<HTMLButtonElement>("button")).find(
          (candidate) => candidate.textContent?.includes(textContent),
        ) ?? null
      : null;
  expect(button).not.toBeNull();
  await act(async () => {
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

export async function changeInput(label: string, value: string) {
  const input = inputByLabel(label);
  expect(input).not.toBeNull();
  await act(async () => {
    if (input) {
      setNativeValue(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
}

export async function changeSelect(label: string, value: string) {
  const select = selectByLabel(label);
  expect(select).not.toBeNull();
  await act(async () => {
    if (select) {
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
}

export async function chooseRadioByLabel(label: string) {
  const radio = radioByLabel(label);
  expect(radio).not.toBeNull();
  await act(async () => {
    radio?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

export async function clickCheckboxByLabel(label: string) {
  const checkbox = checkboxByLabel(label);
  expect(checkbox).not.toBeNull();
  await act(async () => {
    checkbox?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

export async function keyDown(key: string) {
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key }));
  });
}

export async function flushKnowledgeV2WidgetTest() {
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
}

function setNativeValue(element: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(element, "value")?.set;
  const prototype = Object.getPrototypeOf(element) as HTMLInputElement;
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(
    prototype,
    "value",
  )?.set;

  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(element, value);
    return;
  }

  valueSetter?.call(element, value);
}

export function text() {
  return document.body.textContent ?? "";
}

export function headingWithText(textContent: string): HTMLHeadingElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLHeadingElement>("h1,h2,h3")).find(
      (heading) => heading.textContent === textContent,
    ) ?? null
  );
}

export function buttonWithText(textContent: string): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.includes(textContent),
    ) ?? null
  );
}

export function buttonByLabel(label: string): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.getAttribute("aria-label") === label,
    ) ?? null
  );
}

export function inputByLabel(label: string): HTMLInputElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLInputElement>("input")).find(
      (input) => input.getAttribute("aria-label") === label,
    ) ?? null
  );
}

export function selectByLabel(label: string): HTMLSelectElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLSelectElement>("select")).find(
      (select) => select.getAttribute("aria-label") === label,
    ) ?? null
  );
}

function radioByLabel(label: string): HTMLInputElement | null {
  return (
    Array.from(
      document.querySelectorAll<HTMLInputElement>("input[type='radio']"),
    ).find((input) => input.closest("label")?.textContent?.includes(label)) ??
    null
  );
}

function checkboxByLabel(label: string): HTMLInputElement | null {
  return (
    Array.from(
      document.querySelectorAll<HTMLInputElement>("input[type='checkbox']"),
    ).find((input) => input.closest("label")?.textContent?.includes(label)) ??
    null
  );
}

export function regionByName(name: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("[aria-label]")).find(
      (element) => element.getAttribute("aria-label") === name,
    ) ?? null
  );
}

export function dialogByName(name: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("[role='dialog']")).find(
      (element) => element.textContent?.includes(name),
    ) ?? null
  );
}

export function rowByTitle(title: string): HTMLElement | null {
  const titleButton = buttonWithText(title);
  return titleButton?.closest<HTMLElement>(".knowledge-v2-row") ?? null;
}

export function documentFixture(
  overrides: Partial<KnowledgeDocument> = {},
): KnowledgeDocument {
  return {
    catalogItemType: "documentation_knowledge",
    content: "Release process content.",
    createdAt: "2026-01-01T00:00:00.000Z",
    enabled: true,
    knowledgeDocumentId: "kdoc_1",
    lifecycleStatus: "active",
    quickSummary: "Release guide summary.",
    scope: "workspace",
    searchable: true,
    sourceKind: "docs_path",
    sourceLabel: "Release docs",
    sourceRef: "docs/release.md",
    tags: "release",
    title: "Release guide",
    updatedAt: "2026-01-02T00:00:00.000Z",
    workspaceId: "workspace_1",
    ...overrides,
  };
}

export function skillFixture(overrides: Partial<Skill> = {}): Skill {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    prerequisites: "Know the changed files.",
    reviewStatus: "reviewed",
    risks: "Missing regression coverage.",
    skillId: "skill_1",
    steps: "Read the diff.",
    tags: "review",
    title: "React review",
    updatedAt: "2026-01-03T00:00:00.000Z",
    validation: "Run relevant tests.",
    whenToUse: "Use when reviewing React changes.",
    workspaceId: "workspace_1",
    ...overrides,
  };
}

export function draftReviewFixture(
  overrides: Partial<KnowledgeDraftReviewDecision> = {},
): KnowledgeDraftReviewDecision {
  return {
    action: "accepted",
    createdAt: "2026-01-04T00:00:00.000Z",
    draftPackId: "pack_1",
    proposedItemId: "draft_1",
    proposedItemKey: "document:draft_1",
    reviewId: "review_1",
    reviewedAt: "2026-01-04T00:00:00.000Z",
    sourceFingerprint: "fingerprint_1",
    updatedAt: "2026-01-04T00:00:00.000Z",
    workspaceId: "workspace_1",
    ...overrides,
  };
}
