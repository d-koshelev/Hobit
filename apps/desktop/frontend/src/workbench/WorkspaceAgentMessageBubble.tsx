import type { ReactNode } from "react";
import {
  RENDER_MEMORY_CAPS,
  cappedPreviewText,
} from "../renderMemoryGuards";
import type { CoordinatorProviderMessageMeta } from "./coordinatorProviderRequest";
import {
  type WorkspaceAgentRunMetadata,
  runMetadataDurationLabel,
  runMetadataStatusLabel,
  runMetadataThreadLabel,
  runMetadataTokenLabel,
} from "./workspaceAgentRunMetadata";

export type WorkspaceAgentMessageBubbleRole = "operator" | "assistant";

export function WorkspaceAgentMessageBubble({
  body,
  children,
  providerMeta,
  role,
  runMetadata,
}: {
  body: string;
  children?: ReactNode;
  providerMeta?: CoordinatorProviderMessageMeta;
  role: WorkspaceAgentMessageBubbleRole;
  runMetadata?: WorkspaceAgentRunMetadata;
}) {
  return (
    <article
      aria-label={role === "operator" ? "User message" : "Workspace Agent message"}
      className={`interactive-agent-message interactive-agent-message-${role}${
        providerMeta ? ` interactive-agent-message-${providerMeta.tone}` : ""
      }`}
      data-testid={`interactive-agent-message-${role}`}
    >
      {role === "assistant" && runMetadata ? (
        <WorkspaceAgentMessageRunMetadata metadata={runMetadata} />
      ) : null}
      <div className="interactive-agent-message-body">
        {renderMessageBody(body)}
      </div>
      {providerMeta ? (
        <details
          className={`interactive-agent-provider-meta interactive-agent-provider-meta-${providerMeta.tone}`}
        >
          <summary>Details</summary>
          <p>
            Source: {providerMeta.label}.{" "}
            {cappedPreviewText(
              providerMeta.detail,
              RENDER_MEMORY_CAPS.transcriptPayloadChars,
            )}
          </p>
        </details>
      ) : null}
      {children}
    </article>
  );
}

function WorkspaceAgentMessageRunMetadata({
  metadata,
}: {
  metadata: WorkspaceAgentRunMetadata;
}) {
  const durationLabel = runMetadataDurationLabel(metadata.durationMs);
  const threadLabel = runMetadataThreadLabel(metadata.threadId);
  const tokenLabel = runMetadataTokenLabel(metadata.tokenUsage);

  return (
    <dl
      aria-label="Workspace Agent run metadata"
      className={`interactive-agent-run-metadata interactive-agent-run-metadata-${metadata.status}`}
    >
      <div>
        <dt>Status</dt>
        <dd>{runMetadataStatusLabel(metadata.status)}</dd>
      </div>
      <div>
        <dt>Steps</dt>
        <dd>{metadata.stepCount.toString()}</dd>
      </div>
      {durationLabel ? (
        <div>
          <dt>Time</dt>
          <dd>{durationLabel}</dd>
        </div>
      ) : null}
      {threadLabel ? (
        <div>
          <dt>Thread</dt>
          <dd>{threadLabel}</dd>
        </div>
      ) : null}
      {tokenLabel ? (
        <div>
          <dt>Tokens</dt>
          <dd>{tokenLabel}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function renderMessageBody(body: string): ReactNode {
  const segments = body.split(/```/);

  if (segments.length === 1) {
    return (
      <p>
        {cappedPreviewText(body, RENDER_MEMORY_CAPS.transcriptMessageChars)}
      </p>
    );
  }

  return segments.map((segment, index) => {
    const key = `${index}-${segment.slice(0, 12)}`;
    if (index % 2 === 1) {
      const code = segment.replace(/^[\w-]+\n/, "").trim();
      return (
        <pre className="interactive-agent-code-block" key={key}>
          <code>
            {cappedPreviewText(
              code,
              RENDER_MEMORY_CAPS.transcriptPayloadChars,
            )}
          </code>
        </pre>
      );
    }

    return segment.trim() ? (
      <p key={key}>
        {cappedPreviewText(
          segment.trim(),
          RENDER_MEMORY_CAPS.transcriptMessageChars,
        )}
      </p>
    ) : null;
  });
}
