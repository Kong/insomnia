import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

import { createFixture } from "./support";

test("Authorization header is replaced by the request's value, other headers are appended", async ({ user }) => {
  test.fail(true, "INS-4321");
  const { collectionFlow, httpRequestFlow } = user.flowManager;
  const { collection, request } = await createFixture(user.flowManager, {
    request: {
      headers: [
        { name: "Authorization", value: "Bearer request-token" },
        { name: "x-merge", value: "request" },
      ],
    },
  });
  await collectionFlow.setHeaders(collection, [
    { name: "Authorization", value: "Bearer collection-token" },
    { name: "x-merge", value: "collection" },
  ]);

  const response = await httpRequestFlow.send(request);
  expect(response.statusBar.code).toBe(200);
  const headers = (response.preview as { headers: Record<string, string> }).headers;

  // Only the closest value is sent for Authorization, not `collection, request`.
  expect.soft(headers.authorization).toBe("Bearer request-token");
  // Control: any other header is combined, collection first.
  expect.soft(headers["x-merge"]).toBe("collection, request");
});
