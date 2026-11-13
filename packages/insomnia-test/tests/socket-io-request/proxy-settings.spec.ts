import { faker } from "@faker-js/faker";
import { ProjectType } from "@package/enums/project-types";
import { DEFAULT_TIMEOUT, SOCKET_SERVER, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test("Verify Enabling an Unreachable Proxy Fails the Socket.IO Connection", async ({
  user,
}) => {
  const { preferencesFlow, socketIoRequestFlow, workspaceFlow } =
    user.flowManager;
  const { responsePage } = user.pageManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const request = await socketIoRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    url: SOCKET_SERVER,
  });

  await preferencesFlow.set({
    proxyEnabled: true,
    httpProxy: "127.0.0.1:1111",
    httpsProxy: "127.0.0.1:2222",
    noProxy: "",
  });

  await expect(socketIoRequestFlow.connect(request)).rejects.toThrow();
  await expect
    .poll(() => responsePage.getConsole(), { timeout: DEFAULT_TIMEOUT })
    .toContain("xhr poll error");
});
