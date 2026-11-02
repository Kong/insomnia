import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { ProjectType } from "@package/enums/project-types";
import { certPath } from "@package/misc/certs";
import { DEFAULT_TIMEOUT, SOCKET_SERVER_WSS, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";

test("Verify Socket.IO Request Over a TLS Connection", async ({ user }) => {
  const { certificatesFlow, socketIoRequestFlow, workspaceFlow } =
    user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );
  
  await certificatesFlow.setCaCertificate(
    collection,
    certPath("localhost-cert.pem"),
  );

  const request = await socketIoRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    url: SOCKET_SERVER_WSS,
  });
  await socketIoRequestFlow.connect(request);
  const responseView = await socketIoRequestFlow.disconnect(request);

  await expect
    .poll(
      async () =>
        (await responseView.events?.())?.some((event) =>
          event.data.includes("Connected successfully"),
        ),
      { timeout: DEFAULT_TIMEOUT },
    )
    .toBeTruthy();
});
