import * as crypto from "node:crypto";

import { faker } from "@faker-js/faker";

import { ContentType } from "../../enums/content-type";
import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import {
  ENVIRONMENT_TYPE,
  EnvironmentKvPairDataType,
} from "../../models/environment";
import { Project } from "../../models/project";

const testWithVaultKey = test.extend({
  vaultKey: async ({}, use) => {
    const jwk = {
      alg: "A256GCM",
      ext: true,
      k: crypto.randomBytes(32).toString("base64url"),
      key_ops: ["encrypt", "decrypt"],
      kty: "oct",
    };
    await use(Buffer.from(JSON.stringify(jwk), "utf8").toString("base64"));
  },
  vaultSalt: async ({}, use) => {
    await use(crypto.randomBytes(32).toString("hex"));
  },
});

testWithVaultKey(
  "Verify Secret-typed environment variables are stored encrypted and rendered decrypted at send-time",
  async ({ user }) => {
    const { environmentFlow, httpRequestFlow, workspaceFlow } =
      user.flowManager;

    const project = await workspaceFlow.create(
      new Project(faker.string.alphanumeric(10), ProjectType.Local),
    );
    const collection = await workspaceFlow.create(
      project,
      new Collection(faker.string.alphanumeric(10)),
    );

    const globalEnvironment = await environmentFlow.create(project, {
      name: faker.string.alphanumeric(10),
      type: ENVIRONMENT_TYPE,
    });
    const secretValueFoo = faker.string.alphanumeric(10);
    const secretValueHello = faker.string.alphanumeric(10);
    const privateEnvironment = await environmentFlow.create(globalEnvironment, {
      name: faker.string.alphanumeric(10),
      isPrivate: true,
      kvPairData: [
        {
          id: "",
          name: "foo",
          value: secretValueFoo,
          type: EnvironmentKvPairDataType.SECRET,
          enabled: true,
        },
        {
          id: "",
          name: "hello",
          value: secretValueHello,
          type: EnvironmentKvPairDataType.SECRET,
          enabled: true,
        },
      ],
    });
    await environmentFlow.link(collection, privateEnvironment);

    const request = await httpRequestFlow.create(collection, {
      name: faker.string.alphanumeric(10),
      method: HttpMethod.Post,
      url: `${HTTP_SERVER}/post`,
      body: {
        mimeType: ContentType.Plain,
        text: "{{ _.vault.foo }}\n{{ _.vault.hello }}",
      },
    });
    const response = await httpRequestFlow.send(request!);

    expect(response.statusCode).toBe(200);
    expect((response.body as { data: string }).data).toBe(
      `${secretValueFoo}\n${secretValueHello}`,
    );
  },
);
