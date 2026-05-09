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

/**
 * Rewrite anchor `href` values that point at therealdeal.com article
 * URLs (`/<sector>/YYYY/MM/DD/<slug>/`, with or without the canonical
 * domain prefix) so they target this app's `/article/<slug>` route
 * instead. The TRD-mirror corpus is what we serve; sending readers to
 * the live TRD site mid-article would break the in-app reading flow.
 *
 * Slugs that are not in our local mirror will 404 on `/article/<slug>`,
 * which is the same outcome they would have under any other rewrite
 * scheme. External links (non-TRD hosts) and TRD pages that are not
 * articles (e.g., section indexes) are left untouched by the regex.
 *
 * Applied at render time so existing rows (already sanitized into the
 * DB before this rewrite existed) pick up the fix without a backfill.
 */
const TRD_ARTICLE_HREF_RE =
  /href="(?:https?:\/\/(?:www\.)?therealdeal\.com)?\/[\w-]+\/\d{4}\/\d{2}\/\d{2}\/([\w-]+)\/?(?:[?#][^"]*)?"/g;

export function rewriteTrdArticleLinks(html: string): string {
  return html.replace(TRD_ARTICLE_HREF_RE, 'href="/article/$1"');
}
