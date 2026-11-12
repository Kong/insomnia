import { faker } from "@faker-js/faker";
import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { HTTP_SERVER } from "@package/misc/constants";
import { ENCRYPTED_VALUE, readRawDocs } from "@package/misc/db";
import type { UserSession } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { HttpRequest } from "@package/models/http-request";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

export const BEARER_TOKEN = "e2e-known-bearer-token-";

/** A local project + collection holding one HTTP request that uses Bearer auth with a unique, greppable token. */
export async function createBearerRequest(
  user: UserSession,
): Promise<{ collection: Collection; request: HttpRequest; token: string }> {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;
  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );
  const token = `${BEARER_TOKEN}${faker.string.alphanumeric(16)}`;
  const request = await httpRequestFlow.create(
    collection,
    new HttpRequest({
      name: faker.string.alphanumeric(10),
      method: HttpMethod.Post,
      url: `${HTTP_SERVER}/post`,
      authentication: { type: "bearer", token },
    }),
  );
  return { collection, request, token };
}

/**
 * A collection with one request that only succeeds with its real credentials: Basic auth against the mock server's
 * `/auth/basic` (user `user`, password `pass`, which the app stores encrypted). Resolves once the password is on disk,
 * with the workspace id inso is pointed at.
 */
export async function createBasicAuthCollection(
  user: UserSession,
  dataPath: string,
): Promise<{ collection: Collection; request: HttpRequest; workspaceId: string }> {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;
  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );
  const request = await httpRequestFlow.create(
    collection,
    new HttpRequest({
      name: faker.string.alphanumeric(10),
      method: HttpMethod.Get,
      url: `${HTTP_SERVER}/auth/basic`,
      authentication: { type: "basic", username: "user", password: "pass" },
    }),
  );
  const [workspace] = await user.pageManager.findDocs("insomnia.Workspace.db", { name: collection.name });
  await expect
    .poll(
      () => readRawDocs(dataPath, "Request").find((doc) => doc.name === request.name)?.authentication?.password,
      { message: "the Basic auth password reaches the disk" },
    )
    .toMatch(ENCRYPTED_VALUE);
  return { collection, request, workspaceId: workspace._id };
}
