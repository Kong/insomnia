import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { DEFAULT_TIMEOUT,expect, MCP_SERVER, test } from "../../misc/fixtures";
import { McpClient } from "../../models/mcp-client";
import { Project } from "../../models/project";

const mcpUrl = MCP_SERVER;
const tool = "read_wiki_structure";
const args = { repoName: "Kong/insomnia" };
const expectedToolCallResult = expect.objectContaining({
  jsonrpc: expect.stringContaining("2.0"),
  result: expect.objectContaining({
    content: expect.arrayContaining([
      expect.objectContaining({
        type: expect.stringContaining("text"),
        text: expect.stringContaining("Available pages for Kong/insomnia"),
      }),
    ]),
    structuredContent: expect.objectContaining({
      result: expect.stringContaining("Available pages for Kong/insomnia"),
    }),
    isError: false,
  }),
});

test("Verify Create MCP Client", async ({ user }) => {
  const { mcpClientFlow, workspaceFlow } = user.flowManager;
  const { responsePage, workspacePage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const mcpClient = await mcpClientFlow.create(
    project,
    new McpClient(faker.string.alphanumeric(10), mcpUrl),
  );
  await mcpClientFlow.connect(mcpClient);
  const tools = await mcpClientFlow.getTools(mcpClient);
  expect(tools).toEqual(
    expect.arrayContaining([
      "read_wiki_structure",
      "read_wiki_contents",
      "ask_question",
    ]),
  );

  const findToolCallPreview = (
    events: { data: string; preview?: unknown }[] | undefined,
  ) => events?.find((event) => event.data === "tools/call")?.preview;

  const response = await mcpClientFlow.callTool(
    mcpClient,
    tool,
    args,
    async () => {
      const events = await responsePage.getEvents();
      expect(findToolCallPreview(events)).toEqual(expectedToolCallResult);
    },
    15_000,
  );
  await expect
    .poll(async () => findToolCallPreview(await response.events?.()), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toEqual(expectedToolCallResult);

  await workspaceFlow.delete(mcpClient);
  const deletedNames = [mcpClient.name];
  await expect
    .poll(
      async () => {
        const names = (await workspacePage.getNodes()).map((node) => node.name);
        return deletedNames.filter((name) => names.includes(name));
      },
      { timeout: 10_000 },
    )
    .toEqual([]);
});
