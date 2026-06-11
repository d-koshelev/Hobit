import readmeText from "./fixtures/self-development-smoke-prompt-pack/README.md?raw";
import firstPromptText from "./fixtures/self-development-smoke-prompt-pack/001-safe-docs-noop.md?raw";
import secondPromptText from "./fixtures/self-development-smoke-prompt-pack/002-dependent-follow-up.md?raw";
import promptBatchText from "./fixtures/self-development-smoke-prompt-pack/prompt-batch.json?raw";
import realisticReadmeText from "./fixtures/realistic-dogfooding-smoke-pack/README.md?raw";
import realisticFirstPromptText from "./fixtures/realistic-dogfooding-smoke-pack/001-add-dogfooding-smoke-result-doc.md?raw";
import realisticSecondPromptText from "./fixtures/realistic-dogfooding-smoke-pack/002-record-dependent-gate-result.md?raw";
import realisticPromptBatchText from "./fixtures/realistic-dogfooding-smoke-pack/prompt-batch.json?raw";

import type { PromptPackFileEntry } from "./promptPackModel";

export const selfDevelopmentSmokePromptPackFixturePath =
  "apps/desktop/frontend/src/workbench/promptPack/fixtures/self-development-smoke-prompt-pack";

export const selfDevelopmentSmokePromptPackEntries: PromptPackFileEntry[] = [
  {
    path: `${selfDevelopmentSmokePromptPackFixturePath}/README.md`,
    source: "self-development-smoke-fixture",
    text: readmeText,
  },
  {
    path: "prompt-batch.json",
    source: "self-development-smoke-fixture",
    text: promptBatchText,
  },
  {
    path: "001-safe-docs-noop.md",
    source: "self-development-smoke-fixture",
    text: firstPromptText,
  },
  {
    path: "002-dependent-follow-up.md",
    source: "self-development-smoke-fixture",
    text: secondPromptText,
  },
];

export const realisticDogfoodingSmokePromptPackFixturePath =
  "C:\\Users\\Dmitry\\Documents\\prj\\hobit-realistic-dogfooding-smoke-pack";

export const realisticDogfoodingSmokePromptPackEntries: PromptPackFileEntry[] = [
  {
    path: "README.md",
    source: "self-development-smoke-fixture",
    text: realisticReadmeText,
  },
  {
    path: "prompt-batch.json",
    source: "self-development-smoke-fixture",
    text: realisticPromptBatchText,
  },
  {
    path: "001-add-dogfooding-smoke-result-doc.md",
    source: "self-development-smoke-fixture",
    text: realisticFirstPromptText,
  },
  {
    path: "002-record-dependent-gate-result.md",
    source: "self-development-smoke-fixture",
    text: realisticSecondPromptText,
  },
];
