import { faker } from "@faker-js/faker";
import {
  AWSCredentialType,
  HashiCorpCredentialType,
  HashiCorpVaultAuthMethod,
} from "insomnia-data";

import { ContentType } from "../../enums/content-type";
import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import type { HttpRequest } from "../../models/http-request";
import { Project } from "../../models/project";

test("Verify AWS/GCP/HashiCorp Cloud Credentials Resolve via the Vault Template Tag", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow, templateTagFlow, preferencesFlow } =
    user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const awsCredentialName = faker.string.alphanumeric(10);
  const gcpCredentialName = faker.string.alphanumeric(10);
  const hashicorpCredentialName = faker.string.alphanumeric(10);
  await preferencesFlow.set({
    cloudCredentials: [
      {
        provider: "aws",
        name: awsCredentialName,
        credentials: {
          type: AWSCredentialType.file,
          section: faker.string.alphanumeric(8),
          region: faker.string.alphanumeric(8),
        },
      },
      {
        provider: "gcp",
        name: gcpCredentialName,
        credentials: { serviceAccountKeyFilePath: faker.system.filePath() },
      },
      {
        provider: "hashicorp",
        name: hashicorpCredentialName,
        credentials: {
          type: HashiCorpCredentialType.onPrem,
          authMethod: HashiCorpVaultAuthMethod.appRole,
          serverAddress: "http://127.0.0.1",
          role_id: faker.string.alphanumeric(8),
          secret_id: faker.string.alphanumeric(8),
        },
      },
    ],
  });

  const awsTag = "{% vault 'aws', '', '{}' %}";
  const gcpTag = "{% vault 'gcp', '', '{}' %}";
  const hashicorpTag = "{% vault 'hashicorp', '', '{}' %}";
  const request = {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url: `${HTTP_SERVER}/post`,
    body: {
      mimeType: ContentType.Plain,
      text: `${awsTag}\n${gcpTag}\n${hashicorpTag}`,
    },
  } satisfies HttpRequest;
  await httpRequestFlow.create(collection, request);

  const awsResult = await templateTagFlow.edit(awsTag, {
    functionName: "vault",
    credentialName: awsCredentialName,
    preview: "",
  });
  const gcpResult = await templateTagFlow.edit(gcpTag, {
    functionName: "vault",
    credentialName: gcpCredentialName,
    preview: "",
  });
  const hashicorpResult = await templateTagFlow.edit(hashicorpTag, {
    functionName: "vault",
    credentialName: hashicorpCredentialName,
    preview: "",
  });

  const response = await httpRequestFlow.send(request);
  const secondResponse = await httpRequestFlow.send(request);

  expect(awsResult.preview).toBe("aws-secret-value");
  expect(gcpResult.preview).toBe("gcp-secret-value");
  expect(hashicorpResult.preview).toBe("hashicorp-secret-value");
  expect((response.body as { data: string }).data).toContain("aws-secret-value");
  expect((response.body as { data: string }).data).toContain("gcp-secret-value");
  expect((response.body as { data: string }).data).toContain(
    "hashicorp-secret-value",
  );
  expect((secondResponse.body as { data: string }).data).toContain(
    "aws-secret-value",
  );
});
