import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { certPath } from "../../misc/certs";
import { expect, MCP_SERVER_HTTPS, test } from "../../misc/fixtures";
import { McpClient } from "../../models/mcp-client";
import { Project } from "../../models/project";

test("Verify MCP Client Over a TLS Connection", async ({ user }) => {
  const { certificatesFlow, mcpClientFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const mcpClient = await mcpClientFlow.create(
    project,
    new McpClient(faker.string.alphanumeric(10), MCP_SERVER_HTTPS),
  );
  
  await certificatesFlow.setCaCertificate(
    mcpClient,
    certPath("localhost-cert.pem"),
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
});
