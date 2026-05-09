// Text helpers for WordPress payloads.
//
// WordPress's `title.rendered` and `excerpt.rendered` are HTML strings
// even for fields that read as plain text. They commonly contain HTML
// entities (`&#8220;`, `&nbsp;`, `&amp;`, `&hellip;`) and, for excerpt,
// wrapping `<p>` and `</p>` tags. Rendering those values directly via
// JSX text (`<h1>{post.title}</h1>` or `<p>{excerpt}</p>`) shows the
// entities literally because React text rendering does not decode HTML
// entities.
//
// We solve this at sync time by storing decoded plain text in the `title`
// and `excerpt` columns, leaving `excerpt_html` and `content_html` raw so
// the article body keeps its proper markup; the browser decodes the
// entities in `content_html` when it parses the HTML response.
//
// `he` is the de-facto entity decoder in the headless-WP ecosystem; it
// handles every numeric and named entity correctly and is ~5KB.

import { decode } from "he";

/**
 * Decode HTML entities. Use for fields that are plain text (e.g., post
 * title) and that may contain entities like `&#8220;` or `&nbsp;`.
 */
export function decodeText(input: string | null | undefined): string {
  if (!input) return "";
  return decode(input);
}

/**
 * Strip HTML tags then decode HTML entities. Use for fields whose source
 * is HTML but whose rendered destination is plain text (e.g., the post
 * excerpt shown in a card or in `<meta name="description">`).
 */
export function stripAndDecode(input: string | null | undefined): string {
  if (!input) return "";
  return decode(input.replace(/<[^>]*>/g, "")).trim();
}
