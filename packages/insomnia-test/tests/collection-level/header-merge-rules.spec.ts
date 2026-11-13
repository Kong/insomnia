import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

import { createFixture, sendAndReadHeaders } from "./support";

test("Header merge rules: append for normal headers, closest wins for single-value headers", async ({ user }) => {
  const { collectionFlow, folderFlow } = user.flowManager;
  const { collection, folders, request } = await createFixture(user.flowManager, {
    folderDepth: 2,
    request: {
      headers: [
        { name: "x-level", value: "request" },
        { name: "Content-Type", value: "text/request" },
      ],
    },
  });

  await folderFlow.setHeaders(folders[1], [
    { name: "x-level", value: "inner-folder" },
    { name: "Content-Type", value: "text/inner-folder" },
  ]);
  await folderFlow.setHeaders(folders[0], [
    { name: "x-level", value: "outer-folder" },
    { name: "Content-Type", value: "text/outer-folder" },
  ]);
  await collectionFlow.setHeaders(collection, [
    { name: "x-level", value: "collection" },
    { name: "Content-Type", value: "text/collection" },
  ]);

  const headers = await sendAndReadHeaders(user.flowManager, request);
  // Appended furthest ancestor first: collection, outer folder, inner folder, request.
  expect(headers["x-level"]).toBe("collection, outer-folder, inner-folder, request");
  // A single-value header keeps only the closest definition.
  expect(headers["content-type"]).toBe("text/request");
});
