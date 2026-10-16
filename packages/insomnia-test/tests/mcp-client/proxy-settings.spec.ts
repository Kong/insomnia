import * as http from "node:http";
import type { AddressInfo } from "node:net";
import * as net from "node:net";
import type { Duplex } from "node:stream";

import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import {
  expect,
  MCP_SERVER,
  test,
} from "../../misc/fixtures";
import { McpClient } from "../../models/mcp-client";
import { Project } from "../../models/project";

const startRecordingProxy = async () => {
  const targets: string[] = [];
  const sockets = new Set<Duplex>();
  const server = http.createServer((clientReq, clientRes) => {
    const target = new URL(clientReq.url ?? "");
    targets.push(target.host);
    const upstream = http.request(
      {
        host: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method: clientReq.method,
        headers: clientReq.headers,
      },
      (upstreamRes) => {
        clientRes.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
        upstreamRes.pipe(clientRes);
      },
    );
    upstream.on("error", () => clientRes.destroy());
    clientReq.pipe(upstream);
  });
  server.on("connect", (req, clientSocket, head) => {
    targets.push(req.url ?? "");
    sockets.add(clientSocket);
    const [host, port] = (req.url ?? "").split(":");
    const upstream = net.connect(Number(port), host, () => {
      clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      upstream.write(head);
      upstream.pipe(clientSocket);
      clientSocket.pipe(upstream);
    });
    upstream.on("error", () => clientSocket.destroy());
    clientSocket.on("error", () => upstream.destroy());
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    port,
    targets,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
        sockets.forEach((socket) => socket.destroy());
      }),
  };
};

const hostOf = (url: string) =>
  new URL(url.includes("://") ? url : `grpc://${url}`).host;

test("Verify MCP Clients Are Routed Through the Preferences Proxy", async ({
  user,
}) => {
  test.fail(true, "INS-4001");

  const { mcpClientFlow, preferencesFlow, workspaceFlow } = user.flowManager;

  const proxy = await startRecordingProxy();
  try {
    const project = await workspaceFlow.create(
      new Project(faker.string.alphanumeric(10), ProjectType.Local),
    );

    await preferencesFlow.set({
      proxyEnabled: true,
      httpProxy: `127.0.0.1:${proxy.port}`,
      httpsProxy: `127.0.0.1:${proxy.port}`,
      noProxy: "",
    });

    const mcpClient = await mcpClientFlow.create(
      project,
      new McpClient(faker.string.alphanumeric(10), MCP_SERVER),
    );
    await mcpClientFlow.connect(mcpClient);
    const tools = await mcpClientFlow.getTools(mcpClient);

    expect(tools).toEqual(expect.arrayContaining(["read_wiki_structure"]));
    expect(proxy.targets).toContain(hostOf(MCP_SERVER));
  } finally {
    await proxy.close();
  }
});
