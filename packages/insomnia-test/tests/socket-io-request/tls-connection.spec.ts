import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { certPath } from "../../misc/certs";
import {
  DEFAULT_TIMEOUT,
  expect,
  SOCKET_SERVER_WSS,
  test,
} from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify Socket.IO Request Over a TLS Connection", async ({ user }) => {
  const { certificatesFlow, socketIoRequestFlow, workspaceFlow } =
    user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
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
  const response = await socketIoRequestFlow.disconnect(request);

  await expect
    .poll(
      async () =>
        (await response.events?.())?.some((event) =>
          event.data.includes("Connected successfully"),
        ),
      { timeout: DEFAULT_TIMEOUT },
    )
    .toBeTruthy();
});
