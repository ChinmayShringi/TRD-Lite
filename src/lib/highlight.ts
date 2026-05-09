/**
 * Helpers for surfacing query matches in search-result text.
 *
 * Two callers share this file:
 *  1. The `/search` page renders the Postgres `ts_headline` snippet,
 *     which arrives as a plain string with `<mark>...</mark>` literal
 *     wrappers around matched terms (no other tags). We turn that into
 *     React nodes so we never set raw HTML on the DOM.
 *  2. The same page (and any future inline search UI) wraps title and
 *     excerpt strings around the user's query terms, using a regex
 *     match so the output stays case-insensitive and accent-tolerant.
 */

const MARK_OPEN = "<mark>";
const MARK_CLOSE = "</mark>";

export interface HighlightSegment {
  text: string;
  matched: boolean;
}

/**
 * Splits a Postgres ts_headline snippet into alternating plain and
 * highlighted segments. Postgres can emit unbalanced markers in
 * pathological inputs (it never does for our corpus, but we still
 * defend against it so the UI cannot render with a stray opening
 * tag). Any unmatched remainder falls into the trailing plain
 * segment.
 */
export function splitHighlightedSnippet(snippet: string): HighlightSegment[] {
  if (!snippet) return [];
  const segments: HighlightSegment[] = [];
  let cursor = 0;
  while (cursor < snippet.length) {
    const openAt = snippet.indexOf(MARK_OPEN, cursor);
    if (openAt === -1) {
      segments.push({ text: snippet.slice(cursor), matched: false });
      break;
    }
    if (openAt > cursor) {
      segments.push({ text: snippet.slice(cursor, openAt), matched: false });
    }
    const closeAt = snippet.indexOf(MARK_CLOSE, openAt + MARK_OPEN.length);
    if (closeAt === -1) {
      segments.push({
        text: snippet.slice(openAt + MARK_OPEN.length),
        matched: false,
      });
      break;
    }
    segments.push({
      text: snippet.slice(openAt + MARK_OPEN.length, closeAt),
      matched: true,
    });
    cursor = closeAt + MARK_CLOSE.length;
  }
  return segments;
}

/**
 * Tokenizes a free-text query into the case-insensitive whole-word
 * patterns we care about for client-side highlighting. Single
 * stopwords (`a`, `the`, `and`, `or`) are dropped because Postgres FTS
 * also drops them; including them in the highlight regex would
 * highlight every "the" in a body and look broken.
 */
const HIGHLIGHT_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

function escapeForRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildHighlightRegex(query: string): RegExp | null {
  if (!query) return null;
  const tokens = Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .map((t) => t.trim())
        .filter((t) => t.length > 1 && !HIGHLIGHT_STOPWORDS.has(t)),
    ),
  );
  if (tokens.length === 0) return null;
  const pattern = `\\b(?:${tokens.map(escapeForRegex).join("|")})\\w*`;
  return new RegExp(pattern, "giu");
}

/**
 * Splits a plain-text string against a highlight regex into segments
 * the caller can render as alternating plain text and `<mark>` nodes.
 * Returns the input untouched when the regex is null or has no match.
 */
export function splitPlainText(
  text: string,
  regex: RegExp | null,
): HighlightSegment[] {
  if (!text) return [];
  if (!regex) return [{ text, matched: false }];
  const local = new RegExp(regex.source, regex.flags);
  const out: HighlightSegment[] = [];
  let lastIndex = 0;
  for (const m of text.matchAll(local)) {
    const idx = m.index ?? 0;
    if (idx > lastIndex) {
      out.push({ text: text.slice(lastIndex, idx), matched: false });
    }
    out.push({ text: m[0], matched: true });
    lastIndex = idx + m[0].length;
  }
  if (lastIndex < text.length) {
    out.push({ text: text.slice(lastIndex), matched: false });
  }
  return out;
}
