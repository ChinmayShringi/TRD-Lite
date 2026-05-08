/**
 * Per-request GraphQL context. Built fresh for every operation so each
 * DataLoader holds an isolated cache and never leaks data across
 * unrelated requests. Resolvers receive this as the third positional
 * argument.
 */
import { db } from "../db";
import {
  makeAuthorLoader,
  makeMediaLoader,
  makeTermLoader,
  type AuthorLoader,
  type MediaLoader,
  type TermLoader,
} from "./loaders";

export interface GraphQLContext {
  db: typeof db;
  loaders: {
    author: AuthorLoader;
    media: MediaLoader;
    term: TermLoader;
  };
}

export function buildContext(): GraphQLContext {
  return {
    db,
    loaders: {
      author: makeAuthorLoader(),
      media: makeMediaLoader(),
      term: makeTermLoader(),
    },
  };
}
