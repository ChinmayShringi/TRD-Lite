/**
 * Opaque cursor encoding for `posts` connection pagination.
 *
 * Cursor format: base64 of `${publishedAt.toISOString()}|${id}`. The
 * `(publishedAt, id)` tuple is the pagination key used by the resolver:
 * `posts.findMany({ orderBy: [desc(publishedAt), desc(id)] })`. Including
 * `id` as the secondary sort breaks ties for posts that share a
 * publishedAt timestamp, which matters because WP backfills can produce
 * batches with identical seconds.
 *
 * This file deliberately throws on malformed input. A bad cursor is a
 * client bug, not a server bug, and silently treating it as "no cursor"
 * would mask real callsite problems.
 */
import { GraphQLError } from "graphql";

export interface CursorValue {
  publishedAt: Date;
  id: number;
}

/**
 * Encode a `(publishedAt, id)` tuple to an opaque base64 string. The
 * delimiter `|` is safe because both halves are always known shapes
 * (ISO8601 timestamp + decimal integer) and never contain it.
 */
export function encodeCursor(value: CursorValue): string {
  if (!(value.publishedAt instanceof Date) || Number.isNaN(value.publishedAt.getTime())) {
    throw new GraphQLError("encodeCursor: publishedAt must be a valid Date", {
      extensions: { code: "BAD_CURSOR_INPUT" },
    });
  }
  if (!Number.isInteger(value.id) || value.id < 0) {
    throw new GraphQLError("encodeCursor: id must be a non-negative integer", {
      extensions: { code: "BAD_CURSOR_INPUT" },
    });
  }
  const payload = `${value.publishedAt.toISOString()}|${value.id}`;
  return Buffer.from(payload, "utf-8").toString("base64");
}

/**
 * Decode an opaque cursor back to its tuple. Throws GraphQLError on any
 * malformed input (wrong format, bad date, missing id, non-integer id).
 */
export function decodeCursor(cursor: string): CursorValue {
  if (typeof cursor !== "string" || cursor.length === 0) {
    throw new GraphQLError("decodeCursor: cursor must be a non-empty string", {
      extensions: { code: "BAD_CURSOR_INPUT" },
    });
  }

  let raw: string;
  try {
    raw = Buffer.from(cursor, "base64").toString("utf-8");
  } catch {
    throw new GraphQLError("decodeCursor: cursor is not valid base64", {
      extensions: { code: "BAD_CURSOR_INPUT" },
    });
  }

  const sep = raw.lastIndexOf("|");
  if (sep === -1) {
    throw new GraphQLError("decodeCursor: cursor is missing delimiter", {
      extensions: { code: "BAD_CURSOR_INPUT" },
    });
  }

  const dateStr = raw.slice(0, sep);
  const idStr = raw.slice(sep + 1);

  if (dateStr.length === 0 || idStr.length === 0) {
    throw new GraphQLError("decodeCursor: cursor halves are empty", {
      extensions: { code: "BAD_CURSOR_INPUT" },
    });
  }

  const publishedAt = new Date(dateStr);
  if (Number.isNaN(publishedAt.getTime())) {
    throw new GraphQLError(
      `decodeCursor: cursor publishedAt is not a valid date (${dateStr})`,
      { extensions: { code: "BAD_CURSOR_INPUT" } },
    );
  }

  if (!/^[0-9]+$/.test(idStr)) {
    throw new GraphQLError(
      `decodeCursor: cursor id is not a non-negative integer (${idStr})`,
      { extensions: { code: "BAD_CURSOR_INPUT" } },
    );
  }
  const id = Number.parseInt(idStr, 10);
  if (!Number.isInteger(id) || id < 0) {
    throw new GraphQLError(`decodeCursor: cursor id parsed to invalid number (${id})`, {
      extensions: { code: "BAD_CURSOR_INPUT" },
    });
  }

  return { publishedAt, id };
}
