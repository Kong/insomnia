import path from "node:path";

import { faker } from "@faker-js/faker";

import { ProjectType } from "../../../../../enums/project-types";
import { expect, test } from "../../../../../misc/fixtures";
import { Project } from "../../../../../models/project";

test("Verify Importing v5 Files With Legacy Non-Prefixed Ids Keeps Every Request Visible, Editable and Uniquely Identified", async ({
  user,
}) => {
  const {
    workspaceFlow,
    importFlow,
    httpRequestFlow,
    grpcRequestFlow,
    webSocketRequestFlow,
    socketIoRequestFlow,
    mcpClientFlow,
  } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  await importFlow.importFile(
    project,
    path.join(__dirname, "legacy-id-collection.yaml"),
  );
  await importFlow.importFile(
    project,
    path.join(__dirname, "legacy-id-mcp-client.yaml"),
  );

  const collection = await workspaceFlow.getCollection("Legacy Id Collection");
  const rootRequest = await httpRequestFlow.get("Legacy Root Request");
  const nestedRequest = await httpRequestFlow.get("Legacy Nested Request");
  const grpcRequest = await grpcRequestFlow.get("Legacy gRPC Request");
  const webSocketRequest = await webSocketRequestFlow.get(
    "Legacy WebSocket Request",
  );
  const socketIoRequest = await socketIoRequestFlow.get(
    "Legacy Socket.IO Request",
  );
  const mcpClient = await mcpClientFlow.get("Legacy Id MCP Client");

  const renamedRootName = faker.string.alphanumeric(10);
  const renamedNestedName = faker.string.alphanumeric(10);
  const renamedRoot = await workspaceFlow.rename(rootRequest!, renamedRootName);
  const renamedNested = await workspaceFlow.rename(
    nestedRequest!,
    renamedNestedName,
  );

  expect(collection).toBeDefined();
  expect(grpcRequest).toBeDefined();
  expect(webSocketRequest).toBeDefined();
  expect(socketIoRequest).toBeDefined();
  expect(mcpClient).toBeDefined();
  expect(rootRequest!.id).not.toBe(nestedRequest!.id);
  expect(rootRequest!.id).not.toBe("legacy-root-request-id");
  expect(renamedRoot.name).toBe(renamedRootName);
  expect(renamedNested.name).toBe(renamedNestedName);
});
