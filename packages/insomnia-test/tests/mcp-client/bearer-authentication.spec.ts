import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { DEFAULT_TIMEOUT, expect, MCP_SERVER, test } from "../../misc/fixtures";
import { McpClient } from "../../models/mcp-client";
import { Project } from "../../models/project";

test("Verify MCP Client Sends the Bearer Token Header Only When Authentication Is Configured", async ({
  user,
}) => {
  const { mcpClientFlow, workspaceFlow } = user.flowManager;
  const { responsePage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const token = faker.string.alphanumeric(20);
  const authenticatedClient = await mcpClientFlow.create(
    project,
    new McpClient(faker.string.alphanumeric(10), MCP_SERVER, {
      type: "bearer",
      token,
    }),
  );
  await mcpClientFlow.connect(authenticatedClient);
  const tools = await mcpClientFlow.getTools(authenticatedClient);

  await expect
    .poll(() => responsePage.getConsole(), { timeout: DEFAULT_TIMEOUT })
    .toContain(`authorization: Bearer ${token}`);

  const unauthenticatedClient = await mcpClientFlow.create(
    project,
    new McpClient(faker.string.alphanumeric(10), MCP_SERVER),
  );
  await mcpClientFlow.connect(unauthenticatedClient);
  await mcpClientFlow.getTools(unauthenticatedClient);

  await expect
    .poll(() => responsePage.getConsole(), { timeout: DEFAULT_TIMEOUT })
    .toContain("JSON-RPC Method: initialize");
  expect(await responsePage.getConsole()).not.toContain("authorization:");
  expect(tools.length).toBeGreaterThan(0);
});
