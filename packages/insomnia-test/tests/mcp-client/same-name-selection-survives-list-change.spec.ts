import { faker } from "@faker-js/faker";

import { McpPrimitiveType } from "../../enums/mcp-capability";
import { ProjectType } from "../../enums/project-types";
import { DEFAULT_TIMEOUT, expect, test } from "../../misc/fixtures";
import { scriptMcpListServer } from "../../misc/mcp-list-server";
import { McpClient } from "../../models/mcp-client";
import { Project } from "../../models/project";

test("Verify the Selected Same-Name Tool Stays Selected When a Reload Prepends Another Tool to the List", async ({
  user,
}) => {
  test.fail(true, "INS-4147");
  const { mcpClientFlow, workspaceFlow } = user.flowManager;
  const { mcpClientPage } = user.pageManager;

  const sharedName = faker.string.alphanumeric(8);
  const alphaTool = {
    name: sharedName,
    inputSchema: { type: "object", properties: { alpha: { type: "string" } } },
  };
  const betaTool = {
    name: sharedName,
    inputSchema: { type: "object", properties: { beta: { type: "string" } } },
  };
  const key = faker.string.alphanumeric(12);
  const url = await scriptMcpListServer(key, {
    "tools/list": { result: { tools: [alphaTool, betaTool] } },
  });
  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const client = await mcpClientFlow.create(
    project,
    new McpClient(faker.string.alphanumeric(10), url),
  );
  await mcpClientFlow.connect(client);
  await mcpClientPage.clickPrimitiveAt(McpPrimitiveType.Tools, 1);
  await expect
    .poll(() => mcpClientPage.getToolArgumentNames(), { timeout: DEFAULT_TIMEOUT })
    .toEqual(["beta"]);

  await scriptMcpListServer(key, {
    "tools/list": {
      result: {
        tools: [
          { name: faker.string.alphanumeric(8), inputSchema: { type: "object" } },
          alphaTool,
          betaTool,
        ],
      },
    },
  });
  await mcpClientFlow.refresh(client, McpPrimitiveType.Tools);

  await expect
    .poll(() => mcpClientPage.getPrimitiveSelection(McpPrimitiveType.Tools), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toEqual([false, false, true]);
  await expect
    .poll(() => mcpClientPage.getToolArgumentNames(), { timeout: DEFAULT_TIMEOUT })
    .toEqual(["beta"]);
});
