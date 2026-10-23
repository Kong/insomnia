import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import {
  DEFAULT_TIMEOUT,
  expect,
  SOCKET_SERVER,
  test,
} from "../../misc/fixtures";
import {
  Collection,
  Info,
  License,
  Specification,
} from "../../models/collection";
import { EnvironmentKvPairDataType } from "../../models/environment";
import { Project } from "../../models/project";
import type { SocketIORequest } from "../../models/socket-io-request";

const socketIoUrl = SOCKET_SERVER;

test("Verify Socket.IO Request Inside a Collection With Environment and Cookie", async ({
  user,
}) => {
  const { workspaceFlow, environmentFlow, socketIoRequestFlow } =
    user.flowManager;
  const { responsePage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const collectionPath = `/${faker.word.sample()}`;
  const itemPath = `${collectionPath}/{id}`;
  const spec = new Specification(
    new Info(
      faker.company.name(),
      faker.system.semver(),
      faker.lorem.sentence(),
      new License(faker.company.name()),
    ),
    {
      [collectionPath]: {
        get: {
          operationId: "listItems",
          tags: ["items"],
          description: "List items",
          responses: { "200": { description: "OK" } },
        },
        post: {
          operationId: "createItem",
          tags: ["items"],
          description: "Create an item",
          responses: { "200": { description: "OK" } },
        },
      },
      [itemPath]: {
        delete: {
          operationId: "deleteItem",
          tags: ["items"],
          description: "Delete an item",
          parameters: [
            { name: "id", in: "path", required: true, type: "string" },
          ],
          responses: { "200": { description: "OK" } },
        },
      },
    },
  );

  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10), spec),
  );

  const greeting = faker.string.alphanumeric(10);

  const environment = await environmentFlow.create(project, {
    name: faker.string.alphanumeric(10),
    kvPairData: [
      {
        id: "",
        name: "greeting",
        value: greeting,
        type: EnvironmentKvPairDataType.STRING,
        enabled: true,
      },
    ],
  });
  await environmentFlow.link(collection, environment);

  const request = await socketIoRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    url: socketIoUrl,
    message: { eventName: "hello", payload: '"{{greeting}}"' },
  } satisfies SocketIORequest);
  await socketIoRequestFlow.connect(request);
  const sendResponse = await socketIoRequestFlow.sendMessage(request);
  const disconnectResponse = await socketIoRequestFlow.disconnect(
    request,
    async () => {
      const events = await responsePage.getEvents();
      expect(
        events?.some((event) => event.data.includes(greeting)),
      ).toBeTruthy();
    },
  );

  await expect
    .poll(
      async () =>
        (await sendResponse.events?.())?.some((event) =>
          event.data.includes(greeting),
        ),
      { timeout: DEFAULT_TIMEOUT },
    )
    .toBeTruthy();
  await expect
    .poll(
      async () =>
        (await disconnectResponse.events?.())?.findLast((event) =>
          event.data.includes("Disconnected"),
        ),
      { timeout: DEFAULT_TIMEOUT },
    )
    .toBeTruthy();
  const actual = collection.specification!;
  expect(actual.info).toMatchObject({
    title: spec.info.title,
    version: spec.info.version,
    description: spec.info.description,
  });
  expect(actual.info.license?.name).toEqual(spec.info.license?.name);
  expect(Object.keys(actual.paths[collectionPath] ?? {})).toEqual(
    expect.arrayContaining([
      HttpMethod.Get.toLowerCase(),
      HttpMethod.Post.toLowerCase(),
    ]),
  );
  expect(actual.paths[itemPath]).toHaveProperty(
    HttpMethod.Delete.toLowerCase(),
  );
});
