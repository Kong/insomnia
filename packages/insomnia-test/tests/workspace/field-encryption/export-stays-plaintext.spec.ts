import os from "node:os";
import path from "node:path";

import { faker } from "@faker-js/faker";
import { ExportFormat } from "@package/enums/export-format";
import { ProjectType } from "@package/enums/project-types";
import { ENCRYPTED_VALUE, readRawDbText, readRawDocs } from "@package/misc/db";
import { waitForExportedFile } from "@package/misc/export-file";
import { test } from "@package/misc/fixtures";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

import { createBearerRequest } from "./helpers";

// INS-2368 case 06: the export holds the real values, never ciphertext, and imports back into a working collection.
test("Exported collection holds the plaintext token and cookie, and imports into a new project", async ({
  user,
  dataPath,
}) => {
  const { cookieFlow, exportFlow, importFlow, workspaceFlow } = user.flowManager;
  const { collection, request, token } = await createBearerRequest(user);
  const cookieValue = `exported-cookie-value-${faker.string.alphanumeric(10)}`;
  await cookieFlow.link(collection, [{ key: "session", value: cookieValue, domain: "example.com", path: "/" }]);

  const file = path.join(os.tmpdir(), `insomnia-test-export-${Date.now()}.yaml`);
  await exportFlow.exportCollection(collection, ExportFormat.InsomniaV5, file);

  const exported = await waitForExportedFile(file);
  expect(exported).toContain(token);
  expect(exported).toContain(cookieValue);
  expect(exported).not.toContain("enc:insomnia:v1:");

  // Import the file into a project of its own: the copy has a working Bearer token and the same cookie
  const target = await workspaceFlow.createProject(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  await importFlow.importFile(target, file);

  await expect
    .poll(async () => (await user.pageManager.findDocs("insomnia.Request.db", { name: request.name })).length, {
      message: "the imported request appears next to the original",
    })
    .toBe(2);
  const requests = await user.pageManager.findDocs("insomnia.Request.db", { name: request.name });
  for (const doc of requests) {
    expect(doc.authentication, `request ${doc._id}`).toMatchObject({ type: "bearer", token });
  }

  const jars = (await user.pageManager.findDocs("insomnia.CookieJar.db")).filter((jar) =>
    (jar.cookies ?? []).some((cookie: any) => cookie.key === "session" && cookie.value === cookieValue),
  );
  expect(jars, "the original and the imported cookie jar").toHaveLength(2);

  // Importing did not leave anything in plaintext on disk
  await expect
    .poll(() => readRawDocs(dataPath, "Request").filter((doc) => doc.name === request.name).length)
    .toBe(2);
  for (const doc of readRawDocs(dataPath, "Request").filter((d) => d.name === request.name)) {
    expect(doc.authentication.token).toMatch(ENCRYPTED_VALUE);
  }
  const text = readRawDbText(dataPath);
  expect(text).not.toContain(token);
  expect(text).not.toContain(cookieValue);
});
