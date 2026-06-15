import type { HobitAgentSelfTestInstruction } from "./types";

export function createSelfTestInstruction(): HobitAgentSelfTestInstruction {
  return {
    body: [
      "Run Hobit agent API self-test.",
      "Check every capability available to you.",
      "Use dry-run or safe mode.",
      "Do not perform hidden side effects.",
      "Return a structured passed, failed, skipped, and blocked report.",
      "Do not call shell or Codex unless a self-test capability explicitly allows it.",
    ].join(" "),
    id: "hobit.agent.selfTest",
    title: "Hobit agent API self-test",
  };
}
