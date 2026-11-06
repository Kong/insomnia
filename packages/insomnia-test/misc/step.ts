import { test } from "@playwright/test";

function humanize(name: string): string {
  const words = name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
  return words
    .replace(/Graph Ql/g, "GraphQL")
    .replace(/Socket Io/g, "Socket.IO")
    .replace(/\bMcp\b/g, "MCP")
    .replace(/\bGrpc\b/g, "gRPC");
}

const BARE_VERB_PATTERN = /^[a-z]+$/;
const CLASS_SUFFIX_PATTERN = /(Flow|Page)$/;

interface IdentifiedObjectArg {
  pos: number;
  identifier: string;
  typeLabel?: string;
}

function describeArgs(className: string, key: string, args: unknown[]): string {
  let stringArg: string | undefined;
  let stringPos = -1;
  const objectArgs: IdentifiedObjectArg[] = [];

  args.forEach((arg, pos) => {
    if (typeof arg === "string") {
      if (stringArg === undefined) {
        stringArg = arg;
        stringPos = pos;
      }
      return;
    }
    if (!arg || typeof arg !== "object" || Array.isArray(arg)) return;

    const candidate =
      (arg as { name?: unknown; id?: unknown }).name ??
      (arg as { name?: unknown; id?: unknown }).id;
    if (typeof candidate !== "string") return;

    const ctorName = (arg as object).constructor?.name;
    objectArgs.push({
      pos,
      identifier: candidate,
      typeLabel:
        ctorName && ctorName !== "Object" ? humanize(ctorName) : undefined,
    });
  });

  const preposition = key.toLowerCase().startsWith("create") ? "in" : "to";
  const last = objectArgs[objectArgs.length - 1];

  const domain = humanize(className.replace(CLASS_SUFFIX_PATTERN, ""));
  let subject = last?.typeLabel ?? "";
  if (subject === domain) subject = "";
  if (!subject && BARE_VERB_PATTERN.test(key) && domain) subject = domain;

  const primitives = [
    stringArg !== undefined ? { value: stringArg, pos: stringPos } : null,
    last ? { value: last.identifier, pos: last.pos } : null,
  ]
    .filter((p): p is { value: string; pos: number } => p !== null)
    .sort((a, b) => a.pos - b.pos)
    .map((p) => p.value);
  let detail = primitives.length ? ` (${primitives.join(", ")})` : "";

  for (const target of objectArgs.slice(0, -1)) {
    detail += ` ${preposition}${target.typeLabel ? ` ${target.typeLabel}` : ""} (${target.identifier})`;
  }

  return (subject ? ` ${subject}` : "") + detail;
}

/**
 * Method decorator that reports a Flow method as a `test.step()`.
 *
 * Without a `title` the step is named after the method and its arguments
 * (e.g. `Http Request Flow: Create (Request name)`); pass a `title` to
 * override that.
 */
export function step(title?: string) {
  return function <This extends object, Args extends unknown[], Return>(
    target: (this: This, ...args: Args) => Promise<Return>,
    context: ClassMethodDecoratorContext<
      This,
      (this: This, ...args: Args) => Promise<Return>
    >,
  ) {
    const key = String(context.name);
    return function (this: This, ...args: Args): Promise<Return> {
      const className = this.constructor.name;
      const stepTitle =
        title ?? `${humanize(key)}${describeArgs(className, key, args)}`;
      return test.step(`${humanize(className)}: ${stepTitle}`, () =>
        target.call(this, ...args),
      );
    };
  };
}
