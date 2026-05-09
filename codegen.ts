/**
 * graphql-codegen configuration for TRD-Lite.
 *
 * Pipeline:
 *   1. `pnpm codegen:dump-schema` writes the SDL string from
 *      `src/graphql/schema.ts` to `src/graphql/schema.graphql`.
 *   2. graphql-codegen reads that `.graphql` file plus the operation
 *      strings inlined in `src/lib/fragments.ts` (and any operations
 *      that may be inlined in app/ pages later) and emits a single
 *      `src/graphql/__generated__/graphql.ts` containing the schema
 *      types and the per-operation result/variable types.
 *
 * Per plan.md section 15 #4 this is the typed-operations layer the
 * frontend consumes, while the resolvers stay hand-typed against the
 * SDL. We deliberately do NOT pull in any client framework plugin
 * (no react-apollo, no urql, no react-query) because Server Components
 * fetch from the in-process Yoga handler with plain `fetch` and need
 * only the types, not a runtime.
 */
import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  overwrite: true,
  schema: "src/graphql/schema.graphql",
  documents: [
    "src/lib/fragments.ts",
    "src/components/**/*.{ts,tsx}",
    "app/**/*.{ts,tsx}",
    // Exclude the generated output so codegen never re-parses its own
    // emitted types as if they were operation documents (which would
    // double-declare schema types like `Taxonomy`).
    "!src/graphql/__generated__/**",
  ],
  ignoreNoDocuments: true,
  generates: {
    "src/graphql/__generated__/graphql.ts": {
      // typescript-operations 6.x in the one-file setup emits all the
      // schema types it actually needs (Input, Enum, fragment
      // subtypes, operation result/variable shapes). Listing the
      // `typescript` plugin alongside it caused duplicate `Taxonomy`
      // declarations (TS2300). The official codegen v5->v6 migration
      // recommends dropping the `typescript` plugin in this setup.
      // See https://the-guild.dev/graphql/codegen/docs/migration/operations-and-client-preset-from-5-0
      plugins: ["typescript-operations"],
      config: {
        // Treat nullable schema fields as `T | null` rather than
        // optional properties so consumers can rely on the field
        // existing in the response object.
        avoidOptionals: true,
        // Use `import type` so the generated file participates in
        // verbatim-module-syntax-friendly bundling without dragging
        // runtime imports along.
        useTypeImports: true,
        // Map the custom DateTime scalar to the same `string` shape
        // the resolvers serialize to (graphql-scalars' DateTimeResolver
        // produces ISO strings on the wire). ID stays a string for
        // consistency with existing hand-typed shapes in fragments.ts.
        scalars: {
          DateTime: "string",
          ID: "string",
        },
        // Keep `__typename` available so consumers can narrow unions
        // if we ever add one. Cheap to leave on.
        skipTypename: false,
        // Generated operation types like `HomePageQuery` are easier
        // to reason about than the default suffix-less names.
        dedupeOperationSuffix: true,
        // Emit GraphQL enums as string union types rather than
        // TypeScript `enum`s. Two reasons: (1) the typescript and
        // typescript-operations plugins were emitting *both* an enum
        // and a string-union for the same name (`Taxonomy`), which is
        // a TS2567 duplicate-declaration error; (2) the union form is
        // tree-shake-friendly and matches the existing hand-typed
        // shapes in `src/lib/fragments.ts` where `taxonomy` is just a
        // `string`.
        enumsAsTypes: true,
      },
    },
  },
};

export default config;
