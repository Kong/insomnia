import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

import { createFixture } from "./support";

const SINGLE_VALUE_HEADERS = [
  "proxy-authorization",
  "content-length",
  "content-type",
  "content-encoding",
  "content-location",
  "connection",
  "host",
  "upgrade",
  "range",
  "trailer",
];

type Level = "collection" | "outer-folder" | "inner-folder" | "request";

function valueAt(name: string, level: Level): string {
  if (name === "content-type") return `text/${level}`;
  if (level !== "request") return `${name}-${level}`;
  const requestValues: Record<string, string> = {
    "content-length": "0",
    "content-encoding": "identity",
    connection: "keep-alive",
    host: "request.example",
    range: "bytes=0-9",
  };
  return requestValues[name] ?? `${name}-request`;
}

// Header names are case-insensitive: each level writes the same header with a different casing.
function nameAt(name: string, level: Level): string {
  const casings: Record<Level, () => string> = {
    collection: () => name,
    "outer-folder": () => name.replace(/(^|-)([a-z])/g, (_, sep, c) => sep + c.toUpperCase()),
    "inner-folder": () => name.toUpperCase(),
    request: () => name.replace(/[a-z]/g, (c, i) => (i % 2 ? c.toUpperCase() : c)),
  };
  return casings[level]();
}

function headersAt(level: Level) {
  return [
    { name: nameAt("x-level", level), value: level },
    ...SINGLE_VALUE_HEADERS.map((name) => ({ name: nameAt(name, level), value: valueAt(name, level) })),
  ];
}

test("Header merge rules: case-insensitive names, append for normal headers, closest wins for single-value headers", async ({ user }) => {
  const { collectionFlow, folderFlow } = user.flowManager;
  const { collection, folders, request } = await createFixture(user.flowManager, {
    folderDepth: 2,
    request: {
      headers: headersAt("request"),
    },
  });

  await folderFlow.setHeaders(folders[1], headersAt("inner-folder"));
  await folderFlow.setHeaders(folders[0], headersAt("outer-folder"));
  await collectionFlow.setHeaders(collection, headersAt("collection"));

  const response = await user.flowManager.httpRequestFlow.send(request);
  expect(response.statusBar.code).toBe(200);
  const headers = (response.preview as { headers: Record<string, string> }).headers;

  expect(headers["x-level"]).toBe("collection, outer-folder, inner-folder, request");
  for (const name of SINGLE_VALUE_HEADERS) {
    expect.soft(headers[name], name).toBe(valueAt(name, "request"));
  }
});
