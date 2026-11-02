import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { ProjectType } from "../../enums/project-types";
import { certPath } from "../../misc/certs";
import { MCP_SERVER_CUSTOM_CA_HTTPS, test } from "../../misc/fixtures";
import { McpClient } from "../../models/mcp-client";
import { Project } from "../../models/project";

test("Verify Custom CA Certificate Toggle Controls Trust For MCP Client Over TLS", async ({
  user,
}) => {
  const { certificatesFlow, mcpClientFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const mcpClient = await mcpClientFlow.create(
    project,
    new McpClient(faker.string.alphanumeric(10), MCP_SERVER_CUSTOM_CA_HTTPS),
  );
  await mcpClientFlow.connect(mcpClient, { expectConnected: false });
  const toolsBeforeCa = mcpClientFlow.getTools(mcpClient);
  await expect(toolsBeforeCa).rejects.toThrow();

  await certificatesFlow.setCaCertificate(mcpClient, certPath("mtls-ca.pem"));

  await mcpClientFlow.connect(mcpClient);
  const toolsAfterCa = await mcpClientFlow.getTools(mcpClient);
  await mcpClientFlow.disconnect(mcpClient);

  await certificatesFlow.setCaCertificateEnabled(mcpClient, false);

  await mcpClientFlow.connect(mcpClient, { expectConnected: false });
  const toolsAfterDisable = mcpClientFlow.getTools(mcpClient);
  await expect(toolsAfterDisable).rejects.toThrow();

  expect(toolsAfterCa).toEqual(
    expect.arrayContaining([
      "read_wiki_structure",
      "read_wiki_contents",
      "ask_question",
    ]),
  );
});
