import path from "node:path";

import { faker } from "@faker-js/faker";
import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { test } from "@package/misc/fixtures";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test("Verify A text/event-stream Response Imports As An Event Stream Request With The Accept Header", async ({
  user,
}) => {
  const { eventStreamRequestFlow, httpRequestFlow, importFlow, workspaceFlow } =
    user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await importFlow.importFile(
    project,
    path.join(import.meta.dirname, "event-stream.yaml"),
  );
  const stream = await eventStreamRequestFlow.get("Stream events");
  const list = await httpRequestFlow.get("List pets");

  expect(stream).toMatchObject({
    method: HttpMethod.Get,
    url: "{{ _.base_url }}/events",
  });
  expect(stream!.headers).toContainEqual(
    expect.objectContaining({ name: "Accept", value: "text/event-stream" }),
  );
  expect(list).toMatchObject({
    method: HttpMethod.Get,
    url: "{{ _.base_url }}/pets",
  });
});

test("Verify itemSchema With Sequential Media Types Imports As Plain HTTP While 2XX And Existing Accept Event Streams Are Handled", async ({
  user,
}) => {
  const { eventStreamRequestFlow, httpRequestFlow, importFlow, workspaceFlow } =
    user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await importFlow.importFile(
    project,
    path.join(import.meta.dirname, "sequential-media-types.yaml"),
  );
  const jsonl = await httpRequestFlow.get("JSONL log");
  const jsonSeq = await httpRequestFlow.get("JSON sequence log");
  const multipart = await httpRequestFlow.get("Multipart mixed log");
  const ndjson = await httpRequestFlow.get("NDJSON log");
  const wildcard = await eventStreamRequestFlow.get("Wildcard event stream");
  const withAccept = await eventStreamRequestFlow.get(
    "Event stream with existing Accept",
  );

  for (const plain of [jsonl, jsonSeq, multipart, ndjson]) {
    expect(plain).toMatchObject({ method: HttpMethod.Get });
    expect(plain!.headers).not.toContainEqual(
      expect.objectContaining({ value: "text/event-stream" }),
    );
  }
  expect(wildcard!.headers).toContainEqual(
    expect.objectContaining({ name: "Accept", value: "text/event-stream" }),
  );
  expect(withAccept!.headers).toContainEqual(
    expect.objectContaining({
      name: "Accept",
      value: "text/event-stream, application/json",
    }),
  );
  expect(withAccept!.headers).not.toContainEqual(
    expect.objectContaining({ name: "Accept", value: "text/event-stream" }),
  );
});
