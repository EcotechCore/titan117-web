import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

const useWrappers =
  "Use publicQuery, userQuery, userMutation, paidQuery, paidMutation, deviceQuery, deviceMutation, adminQuery or adminMutation from convex/lib/functions.ts (guardrails §2). For actions, call an internal query that runs the same check first.";

export default defineConfig([
  ...tseslint.configs.recommended,
  // The Convex guardrail: public functions are built only from the wrappers,
  // which check the caller before any data leaves the server.
  {
    files: ["convex/**/*.ts"],
    ignores: ["convex/lib/**", "convex/_generated/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "convex/server",
              importNames: ["queryGeneric", "mutationGeneric", "actionGeneric"],
              message: useWrappers,
            },
          ],
          patterns: [
            {
              group: ["**/_generated/server"],
              importNames: ["query", "mutation", "action"],
              message: useWrappers,
            },
          ],
        },
      ],
    },
  },
  globalIgnores(["convex/_generated/**", "node_modules/**"]),
]);
