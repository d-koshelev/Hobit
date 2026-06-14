import type { ReactNode } from "react";

type MarkdownBlock =
  | {
      language: string;
      text: string;
      type: "code";
    }
  | {
      level: 1 | 2 | 3;
      text: string;
      type: "heading";
    }
  | {
      items: string[];
      ordered: boolean;
      type: "list";
    }
  | {
      text: string;
      type: "paragraph";
    };

export function NotesMarkdownPreview({ body }: { body: string }) {
  const trimmedBody = body.trim();
  const wholeJson = parseJson(trimmedBody);

  if (!trimmedBody) {
    return (
      <div className="notes-markdown-preview notes-markdown-preview-empty">
        Nothing to preview.
      </div>
    );
  }

  if (wholeJson.ok) {
    return (
      <div className="notes-markdown-preview">
        <JsonCodeBlock value={JSON.stringify(wholeJson.value, null, 2)} />
      </div>
    );
  }

  return (
    <div className="notes-markdown-preview">
      {parseMarkdownBlocks(body).map((block, index) =>
        renderMarkdownBlock(block, index),
      )}
    </div>
  );
}

function renderMarkdownBlock(block: MarkdownBlock, index: number) {
  switch (block.type) {
    case "code":
      return block.language.toLowerCase() === "json" ? (
        <JsonCodeBlock key={index} value={block.text} />
      ) : (
        <pre className="notes-code-block" key={index}>
          <code>{block.text}</code>
        </pre>
      );
    case "heading": {
      const HeadingTag = `h${block.level}` as "h1" | "h2" | "h3";

      return (
        <HeadingTag className="notes-markdown-heading" key={index}>
          {renderInlineMarkdown(block.text)}
        </HeadingTag>
      );
    }
    case "list": {
      const ListTag = block.ordered ? "ol" : "ul";

      return (
        <ListTag className="notes-markdown-list" key={index}>
          {block.items.map((item, itemIndex) => (
            <li key={`${index}-${itemIndex}`}>{renderInlineMarkdown(item)}</li>
          ))}
        </ListTag>
      );
    }
    case "paragraph":
      return (
        <p className="notes-markdown-paragraph" key={index}>
          {renderInlineMarkdown(block.text)}
        </p>
      );
  }
}

function parseMarkdownBlocks(body: string): MarkdownBlock[] {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fenceMatch = line.match(/^```([A-Za-z0-9_-]+)?\s*$/);

    if (fenceMatch) {
      const language = fenceMatch[1] ?? "";
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !/^```\s*$/.test(lines[index] ?? "")) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      blocks.push({
        language,
        text: codeLines.join("\n"),
        type: "code",
      });
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);

    if (headingMatch) {
      blocks.push({
        level: headingMatch[1].length as 1 | 2 | 3,
        text: headingMatch[2],
        type: "heading",
      });
      index += 1;
      continue;
    }

    const unorderedMatch = line.match(/^\s*[-*]\s+(.+)$/);
    const orderedMatch = line.match(/^\s*\d+\.\s+(.+)$/);

    if (unorderedMatch || orderedMatch) {
      const ordered = Boolean(orderedMatch);
      const items: string[] = [];

      while (index < lines.length) {
        const candidate = lines[index] ?? "";
        const itemMatch = ordered
          ? candidate.match(/^\s*\d+\.\s+(.+)$/)
          : candidate.match(/^\s*[-*]\s+(.+)$/);

        if (!itemMatch) {
          break;
        }

        items.push(itemMatch[1]);
        index += 1;
      }

      blocks.push({
        items,
        ordered,
        type: "list",
      });
      continue;
    }

    const paragraphLines: string[] = [line.trim()];
    index += 1;

    while (index < lines.length) {
      const candidate = lines[index] ?? "";

      if (
        !candidate.trim() ||
        /^```/.test(candidate) ||
        /^#{1,3}\s+/.test(candidate) ||
        /^\s*[-*]\s+/.test(candidate) ||
        /^\s*\d+\.\s+/.test(candidate)
      ) {
        break;
      }

      paragraphLines.push(candidate.trim());
      index += 1;
    }

    blocks.push({
      text: paragraphLines.join(" "),
      type: "paragraph",
    });
  }

  return blocks;
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const tokenPattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(text))) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${match.index}-${token}`;

    if (token.startsWith("`")) {
      nodes.push(
        <code className="notes-inline-code" key={key}>
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      nodes.push(
        <span className="notes-markdown-link-text" key={key}>
          {linkMatch?.[1] ?? token}
        </span>,
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function JsonCodeBlock({ value }: { value: string }) {
  return (
    <pre className="notes-code-block notes-json-code-block">
      <code>{renderJsonTokens(value)}</code>
    </pre>
  );
}

function renderJsonTokens(value: string) {
  const nodes: ReactNode[] = [];
  const tokenPattern =
    /("(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(value))) {
    if (match.index > lastIndex) {
      nodes.push(value.slice(lastIndex, match.index));
    }

    const token = match[0];
    const className =
      token.startsWith('"') && value.slice(match.index + token.length).match(/^\s*:/)
        ? "notes-json-key"
        : token.startsWith('"')
          ? "notes-json-string"
          : token === "true" || token === "false"
            ? "notes-json-boolean"
            : token === "null"
              ? "notes-json-null"
              : "notes-json-number";

    nodes.push(
      <span className={className} key={`${match.index}-${token}`}>
        {token}
      </span>,
    );
    lastIndex = match.index + token.length;
  }

  if (lastIndex < value.length) {
    nodes.push(value.slice(lastIndex));
  }

  return nodes;
}

function parseJson(value: string):
  | {
      ok: true;
      value: unknown;
    }
  | {
      ok: false;
    } {
  if (!value || !/^[\[{]/.test(value)) {
    return { ok: false };
  }

  try {
    return {
      ok: true,
      value: JSON.parse(value) as unknown,
    };
  } catch {
    return { ok: false };
  }
}
