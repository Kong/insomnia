import { faker } from "@faker-js/faker";
import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import type { FlowManager } from "@package/flows/flow-manager";
import { HTTP_SERVER } from "@package/misc/constants";
import { Collection } from "@package/models/collection";
import { Folder } from "@package/models/folder";
import type { HttpRequest, HttpRequestInit } from "@package/models/http-request";
import { Project } from "@package/models/project";

/** `POST` endpoint of the local mock server that echoes the request's headers back as JSON. */
export const ECHO_URL = `${HTTP_SERVER}/post`;

/** Creates a local project with an empty collection. */
export async function createCollection(flowManager: FlowManager): Promise<Collection> {
  const { workspaceFlow } = flowManager;
  const project = await workspaceFlow.createProject(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  return workspaceFlow.createCollection(project, new Collection(faker.string.alphanumeric(10)));
}

export interface Fixture {
  project: Project;
  collection: Collection;
  /** The folders created, outermost first. */
  folders: Folder[];
  request: HttpRequest;
}

/**
 * Creates a local project with a collection, `folderDepth` nested folders and
 * a request against the echo endpoint in the innermost one (or directly under
 * the collection when `folderDepth` is 0).
 */
export async function createFixture(
  flowManager: FlowManager,
  { folderDepth = 0, request = {} }: { folderDepth?: number; request?: Partial<HttpRequestInit> } = {},
): Promise<Fixture> {
  const { workspaceFlow, folderFlow, httpRequestFlow } = flowManager;
  const project = await workspaceFlow.createProject(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const collection = await workspaceFlow.createCollection(project, new Collection(faker.string.alphanumeric(10)));

  const folders: Folder[] = [];
  let parent: Collection | Folder = collection;
  for (let level = 0; level < folderDepth; level++) {
    const folder = await folderFlow.create(parent, new Folder(faker.string.alphanumeric(10)));
    folders.push(folder);
    parent = folder;
  }

  const created = await httpRequestFlow.create(parent, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url: ECHO_URL,
    ...request,
  } as HttpRequest);
  return { project, collection, folders, request: created };
}

/** Sends `request` and returns the headers the echo endpoint received. */
export async function sendAndReadHeaders(
  flowManager: FlowManager,
  request: HttpRequest,
): Promise<Record<string, string>> {
  const response = await flowManager.httpRequestFlow.send(request);
  if (response.statusBar.code !== 200) {
    throw new Error(`Expected 200 from the echo endpoint, got "${response.statusBar.text}"`);
  }
  return (response.preview as { headers: Record<string, string> }).headers;
}

export function basicAuthHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}
