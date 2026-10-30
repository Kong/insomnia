import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { McpPrimitiveType } from "../../enums/mcp-capability";
import { ProjectType } from "../../enums/project-types";
import { DEFAULT_TIMEOUT, test } from "../../misc/fixtures";
import { scriptMcpListServer } from "../../misc/mcp-list-server";
import { McpClient } from "../../models/mcp-client";
import { Project } from "../../models/project";

test("Verify Same-Name Tools, Resources and Prompts Are Each Listed Once and Selecting One Selects Only That Row Through Filter, Collapse and Reload", async ({
  user,
}) => {
  const { mcpClientFlow, workspaceFlow } = user.flowManager;
  const { mcpClientPage } = user.pageManager;

  const sharedName = faker.string.alphanumeric(8);
  const url = await scriptMcpListServer(faker.string.alphanumeric(12), {
    "tools/list": {
      result: {
        tools: [
          { name: sharedName, inputSchema: { type: "object", properties: { alpha: { type: "string" } } } },
          { name: sharedName, inputSchema: { type: "object", properties: { beta: { type: "string" } } } },
        ],
      },
    },
    "resources/list": {
      result: {
        resources: [
          { uri: "file:///first.txt", name: sharedName },
          { uri: "file:///second.txt", name: sharedName },
        ],
      },
    },
    "prompts/list": {
      result: { prompts: [{ name: sharedName }, { name: sharedName }] },
    },
  });
  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const client = await mcpClientFlow.create(
    project,
    new McpClient(faker.string.alphanumeric(10), url),
  );
  await mcpClientFlow.connect(client);

  await mcpClientPage.clickPrimitiveAt(McpPrimitiveType.Tools, 1);
  await expect
    .poll(() => mcpClientPage.getPrimitiveSelection(McpPrimitiveType.Tools), { timeout: DEFAULT_TIMEOUT })
    .toEqual([false, true]);
  await expect
    .poll(() => mcpClientPage.getToolArgumentNames(), { timeout: DEFAULT_TIMEOUT })
    .toEqual(["beta"]);
  await mcpClientPage.clickPrimitiveAt(McpPrimitiveType.Tools, 0);
  await expect
    .poll(() => mcpClientPage.getPrimitiveSelection(McpPrimitiveType.Tools), { timeout: DEFAULT_TIMEOUT })
    .toEqual([true, false]);
  await expect
    .poll(() => mcpClientPage.getToolArgumentNames(), { timeout: DEFAULT_TIMEOUT })
    .toEqual(["alpha"]);

  await mcpClientFlow.filterCapabilities(client, sharedName);
  await mcpClientPage.clickPrimitiveAt(McpPrimitiveType.Tools, 1);
  await expect
    .poll(() => mcpClientPage.getPrimitiveSelection(McpPrimitiveType.Tools), { timeout: DEFAULT_TIMEOUT })
    .toEqual([false, true]);

  await mcpClientFlow.toggleCapability(client, McpPrimitiveType.Tools);
  await mcpClientFlow.toggleCapability(client, McpPrimitiveType.Tools);
  await mcpClientFlow.refresh(client, McpPrimitiveType.Tools);
  await expect
    .poll(() => mcpClientPage.getPrimitiveSelection(McpPrimitiveType.Tools), { timeout: DEFAULT_TIMEOUT })
    .toEqual([false, true]);
  await expect
    .poll(() => mcpClientPage.getToolArgumentNames(), { timeout: DEFAULT_TIMEOUT })
    .toEqual(["beta"]);

  await mcpClientPage.clickPrimitiveAt(McpPrimitiveType.Resources, 1);
  await expect
    .poll(() => mcpClientPage.getPrimitiveSelection(McpPrimitiveType.Resources), { timeout: DEFAULT_TIMEOUT })
    .toEqual([false, true]);
  await mcpClientPage.clickPrimitiveAt(McpPrimitiveType.Prompts, 1);

  expect(await mcpClientPage.getPrimitives(McpPrimitiveType.Tools)).toEqual([sharedName, sharedName]);
  expect(await mcpClientPage.getPrimitives(McpPrimitiveType.Resources)).toEqual([sharedName, sharedName]);
  expect(await mcpClientPage.getPrimitives(McpPrimitiveType.Prompts)).toEqual([sharedName, sharedName]);
  await expect
    .poll(() => mcpClientPage.getPrimitiveSelection(McpPrimitiveType.Prompts), { timeout: DEFAULT_TIMEOUT })
    .toEqual([false, true]);
});
