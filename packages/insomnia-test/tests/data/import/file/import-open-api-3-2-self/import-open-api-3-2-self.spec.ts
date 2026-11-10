import path from "node:path";

import { faker } from "@faker-js/faker";
import { ProjectType } from "@package/enums/project-types";
import { test } from "@package/misc/fixtures";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test("Verify $self Triggers No Network Access And Keeps Local $ref Resolved", async ({
  insomnia,
  user,
}) => {
  const { httpRequestFlow, importFlow, workspaceFlow } = user.flowManager;

  await insomnia.evaluate(() => {
    const globals = globalThis as unknown as {
      __fetchedUrls: string[];
      fetch: typeof fetch;
    };
    globals.__fetchedUrls = [];
    const originalFetch = globals.fetch;
    globals.fetch = (input, init) => {
      globals.__fetchedUrls.push(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      );
      return originalFetch(input, init);
    };
  });
  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await importFlow.importFile(
    project,
    path.join(import.meta.dirname, "self.yaml"),
  );
  const local = await httpRequestFlow.get("Create with local ref");
  const fetchedUrls = await insomnia.evaluate(
    () => (globalThis as unknown as { __fetchedUrls: string[] }).__fetchedUrls,
  );

  expect(
    fetchedUrls.filter((url) => url.includes("self-ref.example.com")),
  ).toEqual([]);
  expect(JSON.parse(local!.body!.text!)).toEqual({
    name: "string",
    status: "available",
  });
});
