import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import {
  DEFAULT_TIMEOUT,
  expect,
  MCP_SERVER,
  test,
} from "../../misc/fixtures";
import { EnvironmentKvPairDataType } from "../../models/environment";
import { McpClient } from "../../models/mcp-client";
import { Project } from "../../models/project";

test("Verify Environment Variable in MCP Client URL Is Resolved", async ({
  user,
}) => {
  const { environmentFlow, mcpClientFlow, workspaceFlow } = user.flowManager;
  const { responsePage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const environment = await environmentFlow.create(project, {
    name: faker.string.alphanumeric(10),
    kvPairData: [
      {
        id: "",
        name: "url",
        value: MCP_SERVER.replace("http://", ""),
        type: EnvironmentKvPairDataType.STRING,
        enabled: true,
      },
    ],
  });

  const mcpClient = await mcpClientFlow.create(
    project,
    new McpClient(faker.string.alphanumeric(10), "http://{{url}}"),
  );
  await environmentFlow.link(mcpClient, environment);

  await mcpClientFlow.connect(mcpClient);
  const tools = await mcpClientFlow.getTools(mcpClient);

  expect(tools).toEqual(
    expect.arrayContaining([
      "read_wiki_structure",
      "read_wiki_contents",
      "ask_question",
    ]),
  );
  await expect
    .poll(() => responsePage.getConsole(), { timeout: DEFAULT_TIMEOUT })
    .toContain(`Preparing request to ${MCP_SERVER}`);
});
