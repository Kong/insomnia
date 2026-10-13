import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import {
  DEFAULT_TIMEOUT,
  expect,
  MCP_SERVER,
  test,
} from "../../misc/fixtures";
import { McpClient } from "../../models/mcp-client";
import { Project } from "../../models/project";

test("Verify Template Tag in MCP Tool Arguments Is Resolved", async ({
  user,
}) => {
  test.fail(true, "INS-4000");

  const { mcpClientFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const mcpClient = await mcpClientFlow.create(
    project,
    new McpClient(faker.string.alphanumeric(10), MCP_SERVER),
  );
  await mcpClientFlow.connect(mcpClient);
  const response = await mcpClientFlow.callTool(
    mcpClient,
    "read_wiki_structure",
    { repoName: "{% base64 'encode', 'normal', 'abc' %}" },
  );

  await expect
    .poll(
      async () =>
        (await response.events?.())?.find((event) => event.data === "tools/call")
          ?.preview,
      { timeout: DEFAULT_TIMEOUT },
    )
    .toEqual(
      expect.objectContaining({
        result: expect.objectContaining({
          structuredContent: expect.objectContaining({
            result: expect.stringContaining("Available pages for YWJj"),
          }),
        }),
      }),
    );
});
