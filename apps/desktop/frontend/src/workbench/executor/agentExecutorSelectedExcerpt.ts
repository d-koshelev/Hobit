export const AGENT_EXECUTOR_SELECTED_EXCERPT_LIMIT = 4000;

export type BoundedAgentExecutorSelectedExcerpt = {
  text: string;
  wasTruncated: boolean;
};

const TRUNCATION_NOTE = "\n[Excerpt truncated to 4000 characters.]";

export function selectedTextInsideElement(
  root: HTMLElement | null,
  selection: Selection | null =
    typeof window === "undefined" ? null : window.getSelection(),
): string | null {
  if (!root || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  for (let index = 0; index < selection.rangeCount; index += 1) {
    const range = selection.getRangeAt(index);

    if (
      !nodeInsideElement(root, range.startContainer) ||
      !nodeInsideElement(root, range.endContainer)
    ) {
      return null;
    }
  }

  return selection.toString();
}

export function boundAgentExecutorSelectedExcerpt(
  value: string,
  limit = AGENT_EXECUTOR_SELECTED_EXCERPT_LIMIT,
): BoundedAgentExecutorSelectedExcerpt | null {
  const text = value.replace(/\r\n/g, "\n").trim();

  if (!text) {
    return null;
  }

  if (text.length <= limit) {
    return {
      text,
      wasTruncated: false,
    };
  }

  const cappedLimit = Math.max(0, limit - TRUNCATION_NOTE.length);

  return {
    text: `${text.slice(0, cappedLimit).trimEnd()}${TRUNCATION_NOTE}`,
    wasTruncated: true,
  };
}

function nodeInsideElement(root: HTMLElement, node: Node) {
  return node === root || root.contains(node);
}
