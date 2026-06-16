import {
  createWidgetAgentContract,
  createWidgetSelfTestInstruction,
} from "./hobitWidgetAgentContract";
import { widgetCapability } from "./widgetAgentContractHelpers";

const terminalSelfTestInstruction = createWidgetSelfTestInstruction({
  body: [
    "Run the Terminal widget contract self-test through contract metadata only.",
    "Confirm the contract exists and declares list/status capabilities.",
    "Confirm runCommand is restricted, unavailable to agents, and never a default product-action path.",
    "Confirm forceKillSession requires explicit confirmation and destructive safety language.",
    "Do not open sessions, run commands, write stdin, stop or kill processes, call Codex or shell, mutate Git, execute rollback, or start Queue workers.",
    "Return structured passed, failed, skipped, or blocked evidence.",
  ].join(" "),
  id: "terminal.selfTest",
  title: "Terminal widget self-test",
});

export const TERMINAL_WIDGET_AGENT_CONTRACT = createWidgetAgentContract({
  availability: { status: "available" },
  capabilities: [
    widgetCapability({
      auditEventNames: ["hobit.widget.terminal.listSessions.requested"],
      capabilityId: "terminal.listSessions",
      confirmationRequirement: "none",
      description:
        "List visible Terminal PTY sessions for the owning Terminal widget where a future safe adapter exists.",
      forbiddenSideEffects: terminalReadForbiddenSideEffects(),
      inputSchemaDescription:
        "Workspace id, workbench id, optional Terminal widget instance id, and bounded result limit.",
      outputSchemaDescription:
        "Visible Terminal session summaries with shell, working directory, status, timestamps, and capped output metadata only.",
      sideEffectLevel: "read",
      supportsDryRun: true,
      supportsPreview: true,
      title: "List Terminal Sessions",
      unavailableReason: terminalAdapterUnavailableReason(),
    }),
    widgetCapability({
      auditEventNames: ["hobit.widget.terminal.readSessionStatus.requested"],
      capabilityId: "terminal.readSessionStatus",
      confirmationRequirement: "none",
      description:
        "Read status for one visible Terminal PTY session without reading hidden transcripts or sending input.",
      forbiddenSideEffects: terminalReadForbiddenSideEffects(),
      inputSchemaDescription:
        "Terminal widget instance id and selected session id.",
      outputSchemaDescription:
        "Session status, shell, working directory, exit state, and bounded buffer metadata.",
      sideEffectLevel: "read",
      supportsDryRun: true,
      supportsPreview: true,
      title: "Read Terminal Session Status",
      unavailableReason: terminalAdapterUnavailableReason(),
    }),
    widgetCapability({
      auditEventNames: ["hobit.widget.terminal.openSession.requested"],
      capabilityId: "terminal.openSession",
      confirmationRequirement: "required",
      description:
        "Restricted execute capability for opening a visible manual Terminal PTY session from explicit shell and working directory inputs.",
      forbiddenSideEffects: terminalExecuteForbiddenSideEffects(),
      inputSchemaDescription:
        "Explicit shell executable, shell argv, working directory, cols/rows, output cap, owning widget scope, and confirmation token.",
      outputSchemaDescription:
        "Visible session creation result or unavailable/blocked result. No hidden session may be created.",
      restricted: true,
      sideEffectLevel: "execute",
      supportsDryRun: false,
      supportsPreview: true,
      title: "Open Terminal Session",
      unavailableReason: terminalAdapterUnavailableReason(),
    }),
    widgetCapability({
      auditEventNames: ["hobit.widget.terminal.runCommand.requested"],
      capabilityId: "terminal.runCommand",
      confirmationRequirement: "required",
      description:
        "Restricted execute capability for the legacy one-shot Terminal command path. It is never a default Hobit product-action path and must not be used for ordinary app actions.",
      forbiddenSideEffects: [
        "product_action_default_path",
        "hidden_command_execution",
        ...terminalExecuteForbiddenSideEffects(),
      ],
      inputSchemaDescription:
        "Explicit program, argv array, working directory, timeout, output caps, owning widget scope, and confirmation token.",
      outputSchemaDescription:
        "One-shot command run status, capped stdout/stderr, exit code, duration, and unavailable/blocked result.",
      restricted: true,
      sideEffectLevel: "execute",
      supportsDryRun: false,
      supportsPreview: true,
      title: "Run Terminal Command",
      unavailableReason: terminalAdapterUnavailableReason(),
    }),
    widgetCapability({
      auditEventNames: ["hobit.widget.terminal.stopCommand.requested"],
      capabilityId: "terminal.stopCommand",
      confirmationRequirement: "recommended",
      description:
        "Restricted execute capability for requesting graceful stop of a visible owned Terminal session.",
      forbiddenSideEffects: [
        "filesystem_rollback",
        ...terminalExecuteForbiddenSideEffects(),
      ],
      inputSchemaDescription:
        "Owning Terminal widget instance id, selected visible session id, and operator-visible reason.",
      outputSchemaDescription:
        "Stop request result with updated session status or unavailable/blocked reason.",
      restricted: true,
      sideEffectLevel: "execute",
      supportsDryRun: false,
      supportsPreview: true,
      title: "Stop Terminal Session",
      unavailableReason: terminalAdapterUnavailableReason(),
    }),
    widgetCapability({
      auditEventNames: ["hobit.widget.terminal.forceKillSession.requested"],
      capabilityId: "terminal.forceKillSession",
      confirmationRequirement: "required",
      description:
        "Restricted destructive capability for force-terminating a visible owned Terminal session. It never rolls back filesystem effects from already-run commands.",
      forbiddenSideEffects: [
        "filesystem_rollback",
        "silent_process_kill",
        ...terminalExecuteForbiddenSideEffects(),
      ],
      inputSchemaDescription:
        "Owning Terminal widget instance id, selected visible session id, explicit confirmation token, and reason.",
      outputSchemaDescription:
        "Force-kill result with updated session status or unavailable/blocked reason.",
      restricted: true,
      sideEffectLevel: "destructive",
      supportsDryRun: false,
      supportsPreview: true,
      title: "Force Kill Terminal Session",
      unavailableReason: terminalAdapterUnavailableReason(),
    }),
    widgetCapability({
      auditEventNames: ["hobit.widget.terminal.selfTest.requested"],
      capabilityId: "terminal.selfTest",
      confirmationRequirement: "none",
      description:
        "Run metadata-only Terminal contract checks without opening sessions, running commands, sending stdin, stopping, or killing processes.",
      forbiddenSideEffects: [
        "terminal_session_create",
        "terminal_command_run",
        "terminal_stdin_write",
        "terminal_stop",
        "terminal_force_kill",
        ...terminalReadForbiddenSideEffects(),
      ],
      inputSchemaDescription:
        "Contract self-test request with dry-run flag and expected hidden side-effect assertions.",
      outputSchemaDescription:
        "Self-test report with contract evidence and skipped or blocked adapter checks.",
      sideEffectLevel: "read",
      supportsDryRun: true,
      supportsPreview: true,
      title: "Terminal Self-Test",
    }),
  ],
  expectedResultDescription:
    "Terminal self-tests validate contract metadata, read/status declarations, restricted command execution, force-kill confirmation, and no command/session execution during self-test.",
  hiddenSideEffectAssertions: [
    "no_terminal_session_create",
    "no_terminal_command_run",
    "no_terminal_stdin_write",
    "no_terminal_stop",
    "no_terminal_force_kill",
    "no_shell_command",
    "no_codex_run",
    "no_git_mutation",
    "no_queue_worker_start",
    "no_rollback_execution",
  ],
  ownerModule: "apps/desktop/frontend/src/workbench/agents/widgets",
  ownerSurface: "Terminal",
  productDescription:
    "Terminal uses the terminal widget identity for visible manual desktop shell work. The current product surface has a PTY-first session UI with explicit shell, argv, working directory, cols/rows, bounded session-only output, xterm rendering, stdin, refresh, resize, Stop, Kill with confirmation, Close, frontend tab/pane presentation, and a collapsed legacy one-shot command fallback with explicit program/argv/working directory and capped final output. Browser fallback cannot run local processes. This Widget Agent Contract is metadata-only: no Terminal agent adapter, hidden Terminal launch, Workspace Agent control, Queue-triggered Terminal execution, persistent transcript, command history, Git mutation, rollback, or scheduler behavior is implemented.",
  selfTestCases: [
    {
      capabilityId: "terminal.selfTest",
      caseId: "terminal:contract-exists",
      expectedResultDescription:
        "The Terminal contract exists with product description, capabilities, and self-test instruction.",
      hiddenSideEffectAssertions: ["no_capability_inference"],
      title: "Contract Exists",
    },
    {
      capabilityId: "terminal.listSessions",
      caseId: "terminal:read-capabilities-declared",
      expectedResultDescription:
        "List and status capabilities are declared as read-only and unavailable until a widget adapter exists.",
      hiddenSideEffectAssertions: ["no_terminal_session_create"],
      title: "Read Capabilities Declared",
    },
    {
      capabilityId: "terminal.runCommand",
      caseId: "terminal:run-command-restricted",
      expectedResultDescription:
        "runCommand is restricted execute metadata, requires confirmation, is unavailable to agents, and is never a default product-action path.",
      hiddenSideEffectAssertions: ["no_terminal_command_run", "no_shell_command"],
      title: "Run Command Restricted",
    },
    {
      capabilityId: "terminal.forceKillSession",
      caseId: "terminal:force-kill-confirmation",
      expectedResultDescription:
        "forceKillSession is destructive/restricted, requires confirmation, and does not claim rollback.",
      hiddenSideEffectAssertions: ["no_terminal_force_kill", "no_rollback_execution"],
      title: "Force Kill Confirmation",
    },
    {
      capabilityId: "terminal.selfTest",
      caseId: "terminal:self-test-no-execution",
      expectedResultDescription:
        "Terminal self-test checks metadata only and does not open sessions, run commands, stop, kill, call shell/Codex, mutate Git, start Queue workers, or execute rollback.",
      hiddenSideEffectAssertions: [
        "no_terminal_session_create",
        "no_terminal_command_run",
        "no_terminal_stop",
        "no_terminal_force_kill",
        "no_shell_command",
        "no_codex_run",
        "no_git_mutation",
        "no_queue_worker_start",
        "no_rollback_execution",
      ],
      title: "Self-Test Does Not Execute",
    },
  ],
  selfTestInstruction: terminalSelfTestInstruction,
  title: "Terminal",
  widgetId: "terminal",
});

function terminalAdapterUnavailableReason() {
  return [
    "Terminal Widget Agent adapter is not implemented yet.",
    "Terminal execute capabilities are restricted and unavailable to Workspace Agent self-tests.",
    "Self-test metadata only; do not open sessions or run commands.",
  ].join(" ");
}

function terminalReadForbiddenSideEffects() {
  return [
    "hidden_terminal_transcript_read",
    "terminal_session_create",
    "terminal_command_run",
    "terminal_stdin_write",
    "terminal_stop",
    "terminal_force_kill",
    "queue_worker_start",
    "codex_run",
    "shell_command",
    "git_mutation",
    "rollback_execution",
  ];
}

function terminalExecuteForbiddenSideEffects() {
  return [
    "hidden_execution",
    "hidden_terminal_launch",
    "agent_triggered_terminal_execution",
    "queue_triggered_terminal_execution",
    "workspace_agent_terminal_control",
    "persistent_transcript",
    "command_history_persistence",
    "automatic_git_mutation",
    "queue_worker_start",
    "codex_run",
    "git_mutation",
    "rollback_execution",
  ];
}
