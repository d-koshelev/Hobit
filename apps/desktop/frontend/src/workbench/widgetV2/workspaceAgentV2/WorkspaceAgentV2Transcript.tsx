import type { ReactNode } from "react";

export type WorkspaceAgentV2MessageRole = "assistant" | "result" | "user";

export type WorkspaceAgentV2MessageMetadata = {
  readonly duration?: string;
  readonly provider?: string;
  readonly session?: string;
  readonly status?: string;
  readonly steps?: string;
  readonly thread?: string;
  readonly tokens?: number;
};

export type WorkspaceAgentV2TranscriptMessage = {
  readonly body: ReactNode;
  readonly id: string;
  readonly metadata?: WorkspaceAgentV2MessageMetadata;
  readonly role: WorkspaceAgentV2MessageRole;
  readonly title?: string;
};

type WorkspaceAgentV2TranscriptProps = {
  readonly emptyState?: ReactNode;
  readonly messages?: readonly WorkspaceAgentV2TranscriptMessage[];
};

type WorkspaceAgentV2MessageProps = {
  readonly message: WorkspaceAgentV2TranscriptMessage;
};

export function WorkspaceAgentV2Transcript({
  emptyState,
  messages = [],
}: WorkspaceAgentV2TranscriptProps) {
  if (messages.length === 0) {
    return (
      <section
        aria-label="Workspace Agent v2 transcript"
        className="workspace-agent-v2-transcript"
      >
        <div className="workspace-agent-v2-empty">
          {emptyState ?? (
            <>
              <h3>Transcript</h3>
              <p>No visible messages in this scaffold.</p>
            </>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Workspace Agent v2 transcript"
      className="workspace-agent-v2-transcript"
    >
      {messages.map((message) => (
        <WorkspaceAgentV2Message key={message.id} message={message} />
      ))}
    </section>
  );
}

export function WorkspaceAgentV2Message({
  message,
}: WorkspaceAgentV2MessageProps) {
  const roleLabel = formatRoleLabel(message.role);

  return (
    <article
      aria-label={`${roleLabel} message`}
      className="workspace-agent-v2-message"
      data-role={message.role}
    >
      <header className="workspace-agent-v2-message-header">
        <span className="workspace-agent-v2-message-role">{roleLabel}</span>
        {message.title ? (
          <span className="workspace-agent-v2-message-title">{message.title}</span>
        ) : null}
      </header>
      <div className="workspace-agent-v2-message-body">{message.body}</div>
      <WorkspaceAgentV2MessageMetadataRow metadata={message.metadata} />
    </article>
  );
}

function WorkspaceAgentV2MessageMetadataRow({
  metadata,
}: {
  readonly metadata?: WorkspaceAgentV2MessageMetadata;
}) {
  const items = metadataItems(metadata);

  if (items.length === 0) {
    return null;
  }

  return (
    <dl
      aria-label="Message metadata"
      className="workspace-agent-v2-message-metadata"
    >
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function metadataItems(metadata?: WorkspaceAgentV2MessageMetadata) {
  if (!metadata) {
    return [];
  }

  return [
    metadata.status ? { label: "Status", value: metadata.status } : null,
    metadata.provider ? { label: "Provider", value: metadata.provider } : null,
    metadata.steps ? { label: "Steps", value: metadata.steps } : null,
    metadata.duration ? { label: "Duration", value: metadata.duration } : null,
    metadata.thread ? { label: "Thread", value: metadata.thread } : null,
    metadata.session ? { label: "Session", value: metadata.session } : null,
    typeof metadata.tokens === "number"
      ? { label: "Tokens", value: String(metadata.tokens) }
      : null,
  ].filter((item): item is { label: string; value: string } => item !== null);
}

function formatRoleLabel(role: WorkspaceAgentV2MessageRole) {
  if (role === "user") {
    return "User";
  }
  if (role === "result") {
    return "Result";
  }
  return "Assistant";
}
