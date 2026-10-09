/**
 * Preferences -> Scripting tab's individually-toggleable rule groups,
 * confirmed live: three "Mask Rules" groups (`disabledSecurityRules`),
 * three "Blocked Properties" groups (`disabledBlockedProperties`), and
 * three "Blocked Roots" groups (`disabledBlockedRoots`) in
 * `insomnia-data/common-src/settings.ts`. Each is a `<h4>` heading in the
 * dialog with its own switch beside it.
 */
export enum ScriptSandboxRuleGroup {
  GlobalAndNodeJsInternals = "Global & Node.js Internals",
  AsyncScheduling = "Async Scheduling",
  RuntimeAPIs = "Runtime APIs",
  PrototypeMutation = "Prototype Mutation",
  StackInspection = "Stack Inspection",
  AccessorHelpers = "Accessor Helpers",
  GlobalObjectAliases = "Global Object Aliases",
  NodeJsInternals = "Node.js Internals",
  Scopes = "Scopes",
}
