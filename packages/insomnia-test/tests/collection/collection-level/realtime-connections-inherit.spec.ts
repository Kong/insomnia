import { faker } from "@faker-js/faker";
import {
  DEFAULT_TIMEOUT,
  GRPC_SERVER,
  SOCKET_IO_HANDSHAKE_SERVER,
  SOCKET_IO_LAST_HANDSHAKE,
  WS_HANDSHAKE_SERVER,
} from "@package/misc/constants";
import { test } from "@package/misc/fixtures";
import type { ResponseView } from "@package/models/response";
import { expect } from "@playwright/test";

import { createCollection } from "./support";

async function waitForEvent(response: ResponseView, needle: string): Promise<string> {
  let found = "";
  await expect
    .poll(
      async () => {
        found = (await response.events()).find((event) => event.data.includes(needle))?.data ?? "";
        return found;
      },
      { timeout: DEFAULT_TIMEOUT },
    )
    .not.toBe("");
  return found;
}

test("WebSocket connection inherits collection headers and auth", async ({ user }) => {
  const { collectionFlow, webSocketRequestFlow } = user.flowManager;
  const collection = await createCollection(user.flowManager);
  await collectionFlow.setHeaders(collection, [{ name: "x-collection", value: "c" }]);
  await collectionFlow.setBearerAuth(collection, { token: "collection-token" });

  const request = await webSocketRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    url: WS_HANDSHAKE_SERVER,
  });
  const response = await webSocketRequestFlow.send(request);

  const { headers } = JSON.parse(await waitForEvent(response, "x-collection"));
  expect(headers["x-collection"]).toBe("c");
  expect(headers.authorization).toBe("Bearer collection-token");
  await webSocketRequestFlow.disconnect(request);
});

test("Socket.IO connection inherits collection headers", async ({ user }) => {
  const { collectionFlow, socketIoRequestFlow } = user.flowManager;
  const collection = await createCollection(user.flowManager);
  const marker = faker.string.alphanumeric(12);
  await collectionFlow.setHeaders(collection, [{ name: "x-collection", value: marker }]);

  const request = await socketIoRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    url: SOCKET_IO_HANDSHAKE_SERVER,
  });
  await socketIoRequestFlow.connect(request);

  await expect
    .poll(
      async () => {
        const handshake = await (await fetch(SOCKET_IO_LAST_HANDSHAKE)).json();
        return handshake?.headers?.["x-collection"];
      },
      { timeout: DEFAULT_TIMEOUT },
    )
    .toBe(marker);
  await socketIoRequestFlow.disconnect(request);
});

test("gRPC call inherits collection headers", async ({ user }) => {
  const { collectionFlow, grpcRequestFlow } = user.flowManager;
  const collection = await createCollection(user.flowManager);
  await collectionFlow.setHeaders(collection, [{ name: "x-test-header", value: "from-collection" }]);

  const request = await grpcRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    url: GRPC_SERVER,
    method: "/hello.HelloService/SayHello",
    body: JSON.stringify({ greeting: "world" }),
  });
  const response = await grpcRequestFlow.send(request);

  expect(response.status).toEqual({ code: "0", message: "OK" });
  expect(response.message).toEqual({ reply: "hello world (from-collection)" });
});
