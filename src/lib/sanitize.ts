/**
 * HTML sanitization for editorial content from WordPress.
 *
 * Per plan.md section 9.5: WordPress content arrives as HTML strings in
 * `content.rendered`. Treating CMS HTML as trusted application code is the
 * most common headless-WP vulnerability. We sanitize at sync time (write),
 * not at render time (read), so the database never holds dangerous markup.
 *
 * The allowlist is tuned for editorial content: text formatting, links,
 * images with srcset, figures with captions, and embeds (iframes for
 * YouTube/Vimeo/Twitter). Inline event handlers, scripts, and unknown
 * schemes (javascript:, data:, etc.) are stripped.
 */
import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = sanitizeHtml.defaults.allowedTags.concat([
  "img",
  "figure",
  "figcaption",
  "iframe",
  "section",
]);

const ALLOWED_ATTRS: sanitizeHtml.IOptions["allowedAttributes"] = {
  ...sanitizeHtml.defaults.allowedAttributes,
  img: [
    "src",
    "srcset",
    "alt",
    "width",
    "height",
    "loading",
    "decoding",
    "class",
  ],
  a: ["href", "target", "rel", "name", "id"],
  iframe: ["src", "width", "height", "frameborder", "allow", "allowfullscreen"],
  "*": ["class", "id"],
};

export function sanitizeArticleHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRS,
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform(
        "a",
        { rel: "noopener noreferrer" },
        true,
      ),
    },
  });
}
