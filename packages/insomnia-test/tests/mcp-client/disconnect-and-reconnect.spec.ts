import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { DEFAULT_TIMEOUT, expect, MCP_SERVER, test } from "../../misc/fixtures";
import { McpClient } from "../../models/mcp-client";
import { Project } from "../../models/project";

test("Verify Disconnecting an MCP Client Closes the Connection and It Can Reconnect", async ({
  user,
}) => {
  const { mcpClientFlow, workspaceFlow } = user.flowManager;
  const { responsePage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const mcpClient = await mcpClientFlow.create(
    project,
    new McpClient(faker.string.alphanumeric(10), MCP_SERVER),
  );
  await mcpClientFlow.connect(mcpClient);
  await mcpClientFlow.getTools(mcpClient);
  await mcpClientFlow.disconnect(mcpClient);

  await expect
    .poll(() => responsePage.getConsole(), { timeout: DEFAULT_TIMEOUT })
    .toContain("Closed MCP connection");

  await mcpClientFlow.connect(mcpClient);
  const toolsAfterReconnect = await mcpClientFlow.getTools(mcpClient);

  expect(toolsAfterReconnect.length).toBeGreaterThan(0);
});
