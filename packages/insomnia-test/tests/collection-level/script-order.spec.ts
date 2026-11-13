import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

import { createFixture } from "./support";

/** Asserts `needles` all appear in `text`, in the given order. */
function expectInOrder(text: string, needles: string[]) {
  const positions = needles.map((needle) => text.indexOf(needle));
  expect(positions, `${needles.join(" < ")} in:\n${text}`).not.toContain(-1);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
}

test("Collection-level pre-request and after-response scripts run before folder and request scripts", async ({
  user,
}) => {
  const { collectionFlow, folderFlow, httpRequestFlow } = user.flowManager;
  const { collection, folders, request } = await createFixture(user.flowManager, {
    folderDepth: 1,
    request: {
      preRequestScript: "console.log('request-pre');",
      afterResponseScript: "console.log('request-after');",
    },
  });

  await folderFlow.setScripts(folders[0], {
    preRequest: "console.log('folder-pre');",
    afterResponse: "console.log('folder-after');",
  });
  await collectionFlow.setScripts(collection, {
    preRequest: "console.log('collection-pre');",
    afterResponse: "console.log('collection-after');",
  });

  const response = await httpRequestFlow.send(request);
  expect(response.statusBar.code).toBe(200);
  await expect
    .poll(() => response.console(), { timeout: DEFAULT_TIMEOUT })
    .toContain("request-after");
  const consoleText = await response.console();

  expectInOrder(consoleText, ["collection-pre", "folder-pre", "request-pre"]);
  expectInOrder(consoleText, ["collection-after", "folder-after", "request-after"]);
});
