import { test } from "@playwright/test";

const step = test.step.bind(test);

const EXCLUDED_METHODS = new Set([
  "setContext",
  "switchTab",
  "fillOneLineEditor",
  "readCodeMirror",
  "setKeyValuePairs",
  "readKeyValuePairs",
  "createProject",
  "createCollection",
  "createDocument",
  "createMcpClient",
  "createEnvironment",
  "rows",
  "fillField",
  "editCookie",
  "caCertificateRow",
  "clientCertificateRow",
  "fileCard",
  "dragRow",
  "invitationRow",
  "oAuth1FieldEditor",
  "oauth2FieldEditor",
  "oauth2TokenInput",
  "projectTypeTile",
  "isToggleOn",
  "setToggle",
  "tab",
  "openAddTabMenu",
  "toAiUrlBackendSettings",
]);

const GET_METHOD_PATTERN = /^get[A-Z]/;

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

interface QueueItem {
  childTitle: string;
  fn: () => unknown;
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
}

interface PageGroup {
  instance: object;
  run: (childTitle: string, fn: () => unknown) => Promise<unknown>;
  close: () => Promise<void>;
}

let isProcessingGroupItem = false;

function createPageGroup(instance: object, title: string): PageGroup {
  const queue: QueueItem[] = [];
  let wake: (() => void) | null = null;
  let closed = false;

  const finished = step(title, async () => {
    for (;;) {
      const item = queue.shift();
      if (item) {
        isProcessingGroupItem = true;
        try {
          item.resolve(await step(item.childTitle, item.fn));
        } catch (e) {
          item.reject(e);
        } finally {
          isProcessingGroupItem = false;
        }
        continue;
      }
      if (closed) return;
      await new Promise<void>((resolve) => (wake = resolve));
    }
  });

  return {
    instance,
    run(childTitle, fn) {
      if (isProcessingGroupItem) return Promise.resolve(step(childTitle, fn));
      return new Promise((resolve, reject) => {
        queue.push({ childTitle, fn, resolve, reject });
        wake?.();
        wake = null;
      });
    },
    async close() {
      closed = true;
      wake?.();
      wake = null;
      await finished;
    },
  };
}

let currentPageGroup: PageGroup | null = null;

async function getPageGroup(
  instance: object,
  humanClassName: string,
): Promise<PageGroup> {
  if (currentPageGroup?.instance === instance) return currentPageGroup;
  if (isProcessingGroupItem && currentPageGroup) return currentPageGroup;
  if (currentPageGroup) {
    const previous = currentPageGroup;
    currentPageGroup = null;
    await previous.close();
  }
  const group = createPageGroup(instance, humanClassName);
  currentPageGroup = group;
  return group;
}

export async function closeOpenStepGroup(): Promise<void> {
  if (!currentPageGroup) return;
  const group = currentPageGroup;
  currentPageGroup = null;
  await group.close();
}

export function instrumentWithSteps<T extends object>(instance: T): T {
  const className = instance.constructor.name;
  const isPageClass = className.endsWith("Page");
  const humanClassName = humanize(className);
  const seen = new Set<string>(["constructor"]);
  let proto = Object.getPrototypeOf(instance);

  while (proto && proto !== Object.prototype) {
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (seen.has(key) || EXCLUDED_METHODS.has(key)) continue;
      seen.add(key);
      if (isPageClass && GET_METHOD_PATTERN.test(key)) continue;

      const descriptor = Object.getOwnPropertyDescriptor(proto, key);
      if (!descriptor || typeof descriptor.value !== "function") continue;

      const original = (instance as any)[key] as (
        ...args: unknown[]
      ) => unknown;
      const childTitle = (args: unknown[]) =>
        `${humanize(key)}${describeArgs(className, key, args)}`;

      (instance as any)[key] = isPageClass
        ? async function (...args: unknown[]) {
            const group = await getPageGroup(instance, humanClassName);
            return group.run(childTitle(args), () =>
              original.apply(instance, args),
            );
          }
        : async function (...args: unknown[]) {
            await closeOpenStepGroup();
            try {
              return await step(`${humanClassName}: ${childTitle(args)}`, () =>
                original.apply(instance, args),
              );
            } finally {
              await closeOpenStepGroup();
            }
          };
    }
    proto = Object.getPrototypeOf(proto);
  }

  return instance;
}
