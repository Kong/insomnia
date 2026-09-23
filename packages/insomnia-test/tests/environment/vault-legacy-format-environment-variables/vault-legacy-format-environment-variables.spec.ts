import * as crypto from "node:crypto";
import path from "node:path";

import { faker } from "@faker-js/faker";

import { ProjectType } from "../../../enums/project-types";
import { expect, test } from "../../../misc/fixtures";
import { Collection } from "../../../models/collection";
import {
  ENVIRONMENT_TYPE,
  EnvironmentKvPairDataType,
} from "../../../models/environment";
import { Project } from "../../../models/project";

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
  "Verify legacy array/object vault environment variables render correctly and a scalar vault value throws the reserved-key error",
  async ({ user }) => {
    const { environmentFlow, httpRequestFlow, importFlow, workspaceFlow } =
      user.flowManager;

    const project = await workspaceFlow.create(
      new Project(faker.string.alphanumeric(10), ProjectType.Local),
    );
    const globalEnvironment = await environmentFlow.create(project, {
      name: faker.string.alphanumeric(10),
      type: ENVIRONMENT_TYPE,
    });
    const secretEnvironment = await environmentFlow.create(globalEnvironment, {
      name: faker.string.alphanumeric(10),
      isPrivate: true,
      kvPairData: [
        {
          id: "",
          name: "secretKey",
          value: faker.string.alphanumeric(10),
          type: EnvironmentKvPairDataType.SECRET,
          enabled: true,
        },
      ],
    });

    await importFlow.importFile(
      project,
      path.join(__dirname, "vault-legacy-formats.yaml"),
    );
    const collection = new Collection("Vault Legacy Format Collection");
    await environmentFlow.link(collection, secretEnvironment);

    await environmentFlow.activate(collection, "legacy vault value array");
    const arrayRequest = await httpRequestFlow.get("legacy-array-vault");
    const arrayResponse = await httpRequestFlow.send(arrayRequest!);

    await environmentFlow.activate(collection, "legacy vault value object");
    const objectRequest = await httpRequestFlow.get("legacy-object-vault");
    const objectResponse = await httpRequestFlow.send(objectRequest!);

    await environmentFlow.activate(collection, "base with vault");
    const invalidRequest = await httpRequestFlow.get("legacy-invalid-vault");

    expect(arrayResponse.statusCode).toBe(200);
    expect((arrayResponse.body as { data: string }).data).toBe(
      "vault_array_a\nvault_array_b",
    );
    expect(objectResponse.statusCode).toBe(200);
    expect((objectResponse.body as { data: string }).data).toBe("secv1\nsecv2");
    await expect(httpRequestFlow.send(invalidRequest!)).rejects.toThrow(
      /vault is a reserved key for insomnia vault/,
    );
  },
);
