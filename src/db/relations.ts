// Drizzle `relations()` declarations. These are what enable the
// relational query API (`db.query.posts.findMany({ with: { ... } })`),
// which is the primary N+1 prevention strategy described in plan.md
// section 7. DataLoader is the fallback layer for resolvers that bypass
// these (e.g., recursively chatty per-row hydration).
import { relations } from "drizzle-orm";

import { authors, media, postTerms, posts, terms } from "./schema";

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(authors, {
    fields: [posts.authorId],
    references: [authors.id],
  }),
  featuredMedia: one(media, {
    fields: [posts.featuredMediaId],
    references: [media.id],
  }),
  terms: many(postTerms),
}));

export const authorsRelations = relations(authors, ({ many }) => ({
  posts: many(posts),
}));

export const mediaRelations = relations(media, ({ many }) => ({
  posts: many(posts),
}));

export const termsRelations = relations(terms, ({ many }) => ({
  postTerms: many(postTerms),
}));

export const postTermsRelations = relations(postTerms, ({ one }) => ({
  post: one(posts, {
    fields: [postTerms.postId],
    references: [posts.id],
  }),
  term: one(terms, {
    fields: [postTerms.termId],
    references: [terms.id],
  }),
}));
