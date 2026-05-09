-- Wave 10A: Postgres full-text search vector + GIN index for `posts`.
--
-- Why a generated STORED column: tsvector is expensive to compute on
-- each query, so we materialize it once at write time. STORED writes
-- the value to disk so the GIN index stays in sync without a trigger.
--
-- Why GIN: it is the right index for tsvector. BTree cannot answer the
-- @@ tsquery match operator efficiently; GIN can.
--
-- Why concatenate title + excerpt + content_html with coalesce: a post
-- with a null excerpt or content_html should not break the generated
-- expression. The 'english' dictionary handles stop words and stemming.

ALTER TABLE "posts" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce("title", '') || ' ' ||
      coalesce("excerpt", '') || ' ' ||
      coalesce("content_html", '')
    )
  ) STORED;

CREATE INDEX "posts_search_vector_idx" ON "posts" USING GIN ("search_vector");
