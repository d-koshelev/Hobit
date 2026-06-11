import readmeText from "./fixtures/self-development-smoke-prompt-pack/README.md?raw";
import firstPromptText from "./fixtures/self-development-smoke-prompt-pack/001-safe-docs-noop.md?raw";
import secondPromptText from "./fixtures/self-development-smoke-prompt-pack/002-dependent-follow-up.md?raw";
import promptBatchText from "./fixtures/self-development-smoke-prompt-pack/prompt-batch.json?raw";

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
