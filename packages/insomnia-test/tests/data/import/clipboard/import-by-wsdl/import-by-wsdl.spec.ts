import * as fs from "node:fs";
import * as path from "node:path";

import { faker } from "@faker-js/faker";

import { ContentType } from "../../../../../enums/content-type";
import { ProjectType } from "../../../../../enums/project-types";
import { expect, test } from "../../../../../misc/fixtures";
import { Project } from "../../../../../models/project";

const wsdl = fs.readFileSync(path.join(__dirname, "calculator.wsdl"), "utf8");
const soapBody = fs.readFileSync(path.join(__dirname, "soap-body.xml"), "utf8");

test("Import WSDL by Clipboard", async ({ user }) => {
  const { httpRequestFlow, importFlow, workspaceFlow } = user.flowManager;
  const { httpRequestPage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await importFlow.importClipboard(project, wsdl);

  const request = await httpRequestFlow.get("Add");
  expect(request).toMatchObject({
    method: "POST",
    url: "http://127.0.0.1:4060/calculator.asmx",
  });

  await httpRequestPage.setBody({
    mimeType: ContentType.XML,
    text: soapBody,
  });

  const response = await httpRequestFlow.send(request!);
  expect(response.statusCode).toBe(200);
  expect(response.body).toContain("AddResult");
  expect(response.body).toContain("9");
});
