import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const url = `${HTTP_SERVER}/get`;

test("Verify switching the Generate Code dialog's target language and client library regenerates the snippet", async ({
  user,
}) => {
  const { httpRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url,
  });

  const shellCurlCode = await workspaceFlow.generateCode(request);
  const pythonCode = await workspaceFlow.generateCode(request, {
    target: "Python",
    client: "http.client",
  });
  const nodeAxiosCode = await workspaceFlow.generateCode(request, {
    target: "Node.js",
    client: "Axios",
  });
  const nodeFetchCode = await workspaceFlow.generateCode(request, {
    target: "Node.js",
    client: "Fetch",
  });

  expect(shellCurlCode).toContain("curl");
  expect(pythonCode).toContain("import http.client");
  expect(nodeAxiosCode).toContain("require('axios')");
  expect(nodeAxiosCode).toContain("axios.request");
  expect(nodeFetchCode).toContain("require('node-fetch')");
  expect(nodeFetchCode).not.toContain("axios");
});
