import {
  QUEUE_TAG_COLOR_OPTIONS,
  type QueueTagColorToken,
} from "./agentQueueTaskUiModel";

export function AgentQueueTagColorSwatch({
  colorToken,
}: {
  colorToken: QueueTagColorToken;
}) {
  return (
    <span
      aria-hidden="true"
      className={["agent-queue-tag-color-swatch", colorToken].join(" ")}
    />
  );
}

export function AgentQueueTagColorControl({
  colorToken,
  onChange,
  queueTagName,
}: {
  colorToken: QueueTagColorToken;
  onChange: (colorToken: QueueTagColorToken) => void;
  queueTagName: string;
}) {
  return (
    <label className="agent-queue-tag-color-control">
      <span className="field-label">Color</span>
      <select
        aria-label={`Color for ${queueTagName}`}
        className="input agent-queue-tag-color-select"
        onChange={(event) =>
          onChange(event.currentTarget.value as QueueTagColorToken)
        }
        value={colorToken}
      >
        {QUEUE_TAG_COLOR_OPTIONS.map((option) => (
          <option key={option.token} value={option.token}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
