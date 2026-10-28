import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { ProjectType } from "../../enums/project-types";
import { DEFAULT_TIMEOUT, test } from "../../misc/fixtures";
import { McpClient } from "../../models/mcp-client";
import { Project } from "../../models/project";

const unreachableUrl = "http://localhost:1/mcp";

test("Verify Connecting to an Unreachable MCP Server Lists No Tools", async ({
  user,
}) => {
  const { mcpClientFlow, workspaceFlow } = user.flowManager;
  const { responsePage } = user.pageManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const mcpClient = await mcpClientFlow.create(
    project,
    new McpClient(faker.string.alphanumeric(10), unreachableUrl),
  );
  await mcpClientFlow.connect(mcpClient, { expectConnected: false });

  await expect(mcpClientFlow.getTools(mcpClient)).rejects.toThrow();
  await expect
    .poll(() => responsePage.getConsole(), { timeout: DEFAULT_TIMEOUT })
    .toContain(`Preparing request to ${unreachableUrl}`);
  await expect
    .poll(() => responsePage.getConsole(), { timeout: DEFAULT_TIMEOUT })
    .toContain("Closed MCP connection");
});
