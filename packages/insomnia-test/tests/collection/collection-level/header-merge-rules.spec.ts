import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

import { createFixture } from "./support";

/** The headers whose value is replaced by the closest definition instead of being appended to. */
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

/**
 * The value `name` gets at `level`. Only the request's value is actually sent, so it has to be one the
 * echo server and curl accept for a request without a body (`content-length: 0`, a `content-encoding`
 * that does not need decoding, ...); every other level gets a recognizable placeholder that must never be sent.
 */
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

function headersAt(level: Level) {
  return [
    { name: "x-level", value: level },
    ...SINGLE_VALUE_HEADERS.map((name) => ({ name, value: valueAt(name, level) })),
  ];
}

test("Header merge rules: append for normal headers, closest wins for single-value headers", async ({ user }) => {
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

  // Normal headers are appended from the collection down to the request.
  expect(headers["x-level"]).toBe("collection, outer-folder, inner-folder, request");
  // Single-value headers keep only the closest definition, the request's.
  for (const name of SINGLE_VALUE_HEADERS) {
    expect.soft(headers[name], name).toBe(valueAt(name, "request"));
  }
});
