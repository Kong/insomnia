import path from "node:path";

import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

const fixture = (fileName: string) => path.join(import.meta.dirname, fileName);

test("Verify inso lint spec Passes Valid OpenAPI 3.1 And 3.2 Specs And Reports Errors In Invalid Ones", async ({
  user,
}) => {
  const { insoFlow } = user.flowManager;

  const valid31 = await insoFlow.lintSpec(fixture("valid-3.1.yaml"));
  const valid32 = await insoFlow.lintSpec(fixture("valid-3.2.yaml"));
  const invalid32 = await insoFlow.lintSpec(fixture("invalid-3.2.yaml"));
  const badExample31 = await insoFlow.lintSpec(fixture("bad-example-3.1.yaml"));

  expect(valid31.exitCode).toBe(0);
  expect(valid31.stdout).not.toMatch(/lint (errors|warnings) found/);
  expect(valid32.exitCode).toBe(0);
  expect(valid32.stdout).not.toMatch(/lint (errors|warnings) found/);
  expect(invalid32.exitCode).not.toBe(0);
  expect(invalid32.stdout).toContain('oas3-schema - "info" property must have required property "title"');
  expect(badExample31.exitCode).not.toBe(0);
  expect(badExample31.stdout).toContain('oas3-valid-media-example - "age" property type must be integer');
});
