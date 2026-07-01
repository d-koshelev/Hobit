import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

export type ModuleButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "quiet";

export type ModuleButtonSize = "compact" | "normal";

export type ModuleStatusTone =
  | "idle"
  | "active"
  | "running"
  | "completed"
  | "blocked"
  | "error"
  | "draft"
  | "disabled";

export type ModuleNoticeTone =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "neutral";

type ModuleFieldProps = HTMLAttributes<HTMLDivElement> & {
  readonly children: ReactNode;
  readonly error?: ReactNode;
  readonly helperText?: ReactNode;
  readonly id?: string;
  readonly label?: ReactNode;
};

type ModuleFieldLabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  readonly children: ReactNode;
};

type ModuleFieldHintProps = HTMLAttributes<HTMLParagraphElement> & {
  readonly children: ReactNode;
  readonly tone?: "muted" | "error";
};

type ModuleTextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  readonly invalid?: boolean;
};

type ModuleTextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  readonly invalid?: boolean;
};

type ModuleButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly children: ReactNode;
  readonly size?: ModuleButtonSize;
  readonly variant?: ModuleButtonVariant;
};

type ModuleStatusProps = HTMLAttributes<HTMLSpanElement> & {
  readonly children?: ReactNode;
  readonly showDot?: boolean;
  readonly tone: ModuleStatusTone;
};

type ModuleStatusDotProps = HTMLAttributes<HTMLSpanElement> & {
  readonly tone: ModuleStatusTone;
};

type ModuleStatusBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  readonly children?: ReactNode;
  readonly tone: ModuleStatusTone;
};

type ModuleTextBlockProps = HTMLAttributes<HTMLDivElement> & {
  readonly children: ReactNode;
};

type ModuleSectionTitleProps = HTMLAttributes<HTMLHeadingElement> & {
  readonly children: ReactNode;
};

type ModuleMutedTextProps = HTMLAttributes<HTMLParagraphElement> & {
  readonly children: ReactNode;
};

type ModuleMonoTextProps = HTMLAttributes<HTMLElement> & {
  readonly children: ReactNode;
};

type ModuleKeyValueRowProps = HTMLAttributes<HTMLDivElement> & {
  readonly label: ReactNode;
  readonly value: ReactNode;
};

type ModuleNoticeProps = HTMLAttributes<HTMLDivElement> & {
  readonly children: ReactNode;
  readonly title?: ReactNode;
  readonly tone?: ModuleNoticeTone;
};

type DescribedControlProps = {
  readonly "aria-describedby"?: string;
  readonly "aria-invalid"?: boolean | "false" | "grammar" | "spelling" | "true";
  readonly id?: string;
};

const MODULE_STATUS_LABELS: Record<ModuleStatusTone, string> = {
  active: "Active",
  blocked: "Blocked",
  completed: "Completed",
  disabled: "Disabled",
  draft: "Draft",
  error: "Error",
  idle: "Idle",
  running: "Running",
};

export function ModuleField({
  children,
  className,
  error,
  helperText,
  id,
  label,
  ...props
}: ModuleFieldProps) {
  const generatedId = useId();
  const resolvedId = id ?? generatedId;
  const childId = getChildId(children);
  const controlId = childId ?? resolvedId;
  const helperId = helperText ? `${resolvedId}-hint` : undefined;
  const errorId = error ? `${resolvedId}-error` : undefined;
  const describedBy = [helperId, errorId].filter(Boolean).join(" ") || undefined;
  const enhancedControl = enhanceFieldControl(children, {
    controlId,
    describedBy,
    invalid: Boolean(error),
  });

  return (
    <div
      {...props}
      className={["module-field", className].filter(Boolean).join(" ")}
      data-invalid={error ? "true" : "false"}
    >
      {label ? (
        <ModuleFieldLabel htmlFor={controlId}>{label}</ModuleFieldLabel>
      ) : null}
      <div className="module-field-control">{enhancedControl}</div>
      {helperText ? (
        <ModuleFieldHint id={helperId}>{helperText}</ModuleFieldHint>
      ) : null}
      {error ? (
        <ModuleFieldHint id={errorId} role="alert" tone="error">
          {error}
        </ModuleFieldHint>
      ) : null}
    </div>
  );
}

export function ModuleFieldLabel({
  children,
  className,
  ...props
}: ModuleFieldLabelProps) {
  return (
    <label
      {...props}
      className={["module-field-label", className].filter(Boolean).join(" ")}
    >
      {children}
    </label>
  );
}

export function ModuleFieldHint({
  children,
  className,
  tone = "muted",
  ...props
}: ModuleFieldHintProps) {
  return (
    <p
      {...props}
      className={[
        "module-field-hint",
        `module-field-hint-${tone}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </p>
  );
}

export const ModuleTextInput = forwardRef<
  HTMLInputElement,
  ModuleTextInputProps
>(function ModuleTextInput(
  { className, invalid = false, type = "text", ...props },
  ref,
) {
  const ariaInvalid = props["aria-invalid"] ?? (invalid ? "true" : undefined);

  return (
    <input
      {...props}
      aria-invalid={ariaInvalid}
      className={["module-text-input", className].filter(Boolean).join(" ")}
      data-invalid={invalid ? "true" : "false"}
      ref={ref}
      type={type}
    />
  );
});

export const ModuleTextArea = forwardRef<
  HTMLTextAreaElement,
  ModuleTextAreaProps
>(function ModuleTextArea({ className, invalid = false, ...props }, ref) {
  const ariaInvalid = props["aria-invalid"] ?? (invalid ? "true" : undefined);

  return (
    <textarea
      {...props}
      aria-invalid={ariaInvalid}
      className={["module-text-area", className].filter(Boolean).join(" ")}
      data-invalid={invalid ? "true" : "false"}
      ref={ref}
    />
  );
});

export const ModuleButton = forwardRef<HTMLButtonElement, ModuleButtonProps>(
  function ModuleButton(
    {
      children,
      className,
      size = "normal",
      type = "button",
      variant = "secondary",
      ...props
    },
    ref,
  ) {
    return (
      <button
        {...props}
        className={[
          "module-button",
          `module-button-${variant}`,
          `module-button-${size}`,
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        data-module-button-size={size}
        data-module-button-variant={variant}
        ref={ref}
        type={type}
      >
        {children}
      </button>
    );
  },
);

export function ModuleStatus({
  children,
  className,
  showDot = true,
  tone,
  ...props
}: ModuleStatusProps) {
  return (
    <span
      {...props}
      className={["module-status", `module-status-${tone}`, className]
        .filter(Boolean)
        .join(" ")}
      data-module-status-tone={tone}
    >
      {showDot ? <ModuleStatusDot tone={tone} /> : null}
      <span className="module-status-label">
        {children ?? MODULE_STATUS_LABELS[tone]}
      </span>
    </span>
  );
}

export function ModuleStatusDot({
  className,
  tone,
  ...props
}: ModuleStatusDotProps) {
  return (
    <span
      {...props}
      aria-hidden="true"
      className={["module-status-dot", `module-status-dot-${tone}`, className]
        .filter(Boolean)
        .join(" ")}
      data-module-status-tone={tone}
    />
  );
}

export function ModuleStatusBadge({
  children,
  className,
  tone,
  ...props
}: ModuleStatusBadgeProps) {
  return (
    <span
      {...props}
      className={[
        "module-status-badge",
        `module-status-badge-${tone}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-module-status-tone={tone}
    >
      {children ?? MODULE_STATUS_LABELS[tone]}
    </span>
  );
}

export function ModuleTextBlock({
  children,
  className,
  ...props
}: ModuleTextBlockProps) {
  return (
    <div
      {...props}
      className={["module-text-block", className].filter(Boolean).join(" ")}
    >
      {children}
    </div>
  );
}

export function ModuleSectionTitle({
  children,
  className,
  ...props
}: ModuleSectionTitleProps) {
  return (
    <h3
      {...props}
      className={["module-section-title", className].filter(Boolean).join(" ")}
    >
      {children}
    </h3>
  );
}

export function ModuleMutedText({
  children,
  className,
  ...props
}: ModuleMutedTextProps) {
  return (
    <p
      {...props}
      className={["module-muted-text", className].filter(Boolean).join(" ")}
    >
      {children}
    </p>
  );
}

export function ModuleMonoText({
  children,
  className,
  ...props
}: ModuleMonoTextProps) {
  return (
    <code
      {...props}
      className={["module-mono-text", className].filter(Boolean).join(" ")}
    >
      {children}
    </code>
  );
}

export function ModuleKeyValueRow({
  className,
  label,
  value,
  ...props
}: ModuleKeyValueRowProps) {
  return (
    <div
      {...props}
      className={["module-key-value-row", className].filter(Boolean).join(" ")}
    >
      <span className="module-key-value-label">{label}</span>
      <span className="module-key-value-value">{value}</span>
    </div>
  );
}

export function ModuleNotice({
  children,
  className,
  title,
  tone = "neutral",
  ...props
}: ModuleNoticeProps) {
  return (
    <div
      {...props}
      className={["module-notice", `module-notice-${tone}`, className]
        .filter(Boolean)
        .join(" ")}
      data-module-notice-tone={tone}
    >
      {title ? <strong className="module-notice-title">{title}</strong> : null}
      <div className="module-notice-body">{children}</div>
    </div>
  );
}

function getChildId(children: ReactNode) {
  if (!isValidElement(children)) {
    return undefined;
  }

  return (children as ReactElement<DescribedControlProps>).props.id;
}

function enhanceFieldControl(
  children: ReactNode,
  options: {
    readonly controlId: string;
    readonly describedBy?: string;
    readonly invalid: boolean;
  },
) {
  if (!isValidElement(children)) {
    return children;
  }

  const child = children as ReactElement<DescribedControlProps>;

  return cloneElement(child, {
    id: options.controlId,
    ...(options.describedBy
      ? {
          "aria-describedby": mergeDescribedBy(
            child.props["aria-describedby"],
            options.describedBy,
          ),
        }
      : undefined),
    ...(options.invalid
      ? {
          "aria-invalid": true,
        }
      : undefined),
  });
}

function mergeDescribedBy(existing?: string, additional?: string) {
  if (!existing) {
    return additional;
  }

  if (!additional) {
    return existing;
  }

  return [existing, additional]
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter((entry, index, values) => entry && values.indexOf(entry) === index)
    .join(" ");
}
