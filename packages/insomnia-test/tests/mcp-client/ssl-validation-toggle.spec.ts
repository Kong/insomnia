import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { ProjectType } from "../../enums/project-types";
import { MCP_SERVER_HTTPS, test } from "../../misc/fixtures";
import { McpClient } from "../../models/mcp-client";
import { Project } from "../../models/project";

test("Verify Disabling SSL Certificate Validation Lets MCP Client Connect To A Self-Signed Server", async ({
  user,
}) => {
  const { certificatesFlow, mcpClientFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const mcpClient = await mcpClientFlow.create(
    project,
    new McpClient(faker.string.alphanumeric(10), MCP_SERVER_HTTPS),
  );
  await mcpClientFlow.connect(mcpClient, { expectConnected: false });
  const toolsWithValidation = mcpClientFlow.getTools(mcpClient);
  await expect(toolsWithValidation).rejects.toThrow();

  await certificatesFlow.setSslValidationEnabled(mcpClient, false);

  await mcpClientFlow.connect(mcpClient);
  const toolsWithoutValidation = await mcpClientFlow.getTools(mcpClient);

  expect(toolsWithoutValidation).toEqual(
    expect.arrayContaining([
      "read_wiki_structure",
      "read_wiki_contents",
      "ask_question",
    ]),
  );
});
