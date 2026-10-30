import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { ResponseExportOption } from "../../enums/response-export-option";
import { DEFAULT_TIMEOUT, HTTP_SERVER, LONG_TIMEOUT, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const LARGE_RESPONSE_BYTES = 5 * 1024 * 1024;

test("Verify exporting a small JSON response as raw, prettified and HTTP debug files", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;

  const exportDir = fs.mkdtempSync(path.join(os.tmpdir(), "insomnia-export-"));
  const rawPath = path.join(exportDir, "response-raw.json");
  const prettifiedPath = path.join(exportDir, "response-pretty.json");
  const debugPath = path.join(exportDir, "response-debug.txt");

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const marker = faker.string.alphanumeric(10);
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url: `${HTTP_SERVER}/post?marker=${marker}`,
  });
  await httpRequestFlow.send(request);
  await httpRequestFlow.exportResponse(ResponseExportOption.Raw, rawPath);
  await httpRequestFlow.exportResponse(ResponseExportOption.Prettified, prettifiedPath);
  await httpRequestFlow.exportResponse(ResponseExportOption.HttpDebug, debugPath);

  await expect
    .poll(() => [rawPath, prettifiedPath, debugPath].every((file) => fs.existsSync(file) && fs.statSync(file).size > 0), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toBe(true);
  const raw = fs.readFileSync(rawPath, "utf8");
  const prettified = fs.readFileSync(prettifiedPath, "utf8");
  const debug = fs.readFileSync(debugPath, "utf8");
  fs.rmSync(exportDir, { recursive: true, force: true });

  expect(JSON.parse(raw)).toMatchObject({ args: { marker } });
  expect(JSON.parse(prettified)).toEqual(JSON.parse(raw));
  expect(prettified.length).toBeGreaterThan(raw.length);
  expect(debug).toContain("Content-Type");
  expect(debug).toContain(marker);
});

test("Verify a large JSON response can be exported raw or saved to file, and prettified export is disabled", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;

  const exportDir = fs.mkdtempSync(path.join(os.tmpdir(), "insomnia-export-"));
  const rawPath = path.join(exportDir, "response-large.json");
  const savedPath = path.join(exportDir, "response-saved.json");

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/large-json`,
  });
  await httpRequestFlow.send(request);
  const prettifiedState = await httpRequestFlow.getResponseExportOptionState(
    ResponseExportOption.Prettified,
  );
  await httpRequestFlow.exportResponse(ResponseExportOption.Raw, rawPath);
  await httpRequestFlow.saveResponseToFile(savedPath);

  await expect
    .poll(() => [rawPath, savedPath].every((file) => fs.existsSync(file) && fs.statSync(file).size > LARGE_RESPONSE_BYTES), {
      timeout: LONG_TIMEOUT,
    })
    .toBe(true);
  const rawSize = fs.statSync(rawPath).size;
  const savedHead = fs.readFileSync(savedPath).subarray(0, 16).toString("utf8");
  fs.rmSync(exportDir, { recursive: true, force: true });

  expect(rawSize).toBeGreaterThan(LARGE_RESPONSE_BYTES);
  expect(savedHead).toContain('{"items"');
  expect(prettifiedState.text).toContain("must be <5MB");
  expect(prettifiedState.disabled).toBe(true);
});
