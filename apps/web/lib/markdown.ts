const INVISIBLE_CHARS_REGEX = /[\u200B-\u200F\u2060\uFEFF]/g;
const NON_STANDARD_SPACES_REGEX = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;

export function normalizeMarkdownInput(raw: string): string {
  let text = raw
    .replace(INVISIBLE_CHARS_REGEX, "")
    .replace(NON_STANDARD_SPACES_REGEX, " ")
    .replace(/\r\n?/g, "\n")
    .trim();

  // Common LLM wrappers such as "markdown" prefix or fenced markdown blocks.
  text = text.replace(/^```(?:markdown|md)?\s*/i, "").replace(/\s*```$/, "");
  text = text.replace(/^\s*(?:h\s*)?markdown\b[:\s-]*/i, "");
  text = text.replace(/!\s+\[/g, "![");
  text = text.replace(/\]\s+\(/g, "](");

  // If content is escaped one-line markdown, decode escaped newlines.
  const escapedNewlineCount = (text.match(/\\n/g) || []).length;
  const newlineCount = (text.match(/\n/g) || []).length;
  if (escapedNewlineCount >= 2 && newlineCount <= 1) {
    text = text.replace(/\\n/g, "\n");
  }

  const isCollapsedMarkdown =
    newlineCount <= 1 &&
    (/(^|\s)#{1,6}\s/.test(text) ||
      /!\[[^\]]*]\([^)]+\)/.test(text) ||
      /\s---\s/.test(text) ||
      /\s-\s\*\*/.test(text));

  if (isCollapsedMarkdown) {
    text = text
      .replace(/([^\n])\s+(#{1,6}\s)/g, "$1\n\n$2")
      .replace(/([^\n])\s+(#{1,6})(?=[^\s#])/g, "$1\n\n$2 ")
      .replace(/\s+---\s+/g, "\n\n---\n\n")
      .replace(/\s-\s(?=\*\*|[A-Za-zა-ჰА-Яа-я0-9])/g, "\n- ");
  }

  // Normalize malformed headings like "##Title" -> "## Title".
  text = text.replace(/(^|\n)(#{1,6})([^\s#])/g, "$1$2 $3");

  return text.replace(/\n{3,}/g, "\n\n").trim();
}
