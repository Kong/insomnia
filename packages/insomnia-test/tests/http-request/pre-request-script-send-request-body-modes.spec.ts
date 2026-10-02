import { faker } from "@faker-js/faker";

import { ContentType } from "../../enums/content-type";
import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const url = `${HTTP_SERVER}/post`;

test("Verify pre-request script's sendRequest serializes raw, urlencoded, graphql, and formdata bodies correctly", async ({
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

  const rawValue = faker.string.alphanumeric(10);
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    body: {
      mimeType: ContentType.JSON,
      text: `{"results": {{ results }}}`,
    },
    preRequestScript: `
      const results = {};
      const modes = [
        { key: 'raw', body: { mode: 'raw', raw: '${rawValue}' } },
        { key: 'urlencoded', body: { mode: 'urlencoded', urlencoded: [{ key: 'a', value: '1' }, { key: 'b', value: '2' }] } },
        { key: 'graphql', body: { mode: 'graphql', graphql: { query: '{ __typename }', variables: {} } } },
        { key: 'formdata', body: { mode: 'formdata', formdata: [{ key: 'c', value: '3' }] } },
      ];
      for (const m of modes) {
        const resp = await insomnia.sendRequest({ url: '${url}', method: 'POST', body: m.body });
        results[m.key] = resp.body;
      }
      insomnia.environment.set('results', JSON.stringify(results));
    `,
  });
  const response = await httpRequestFlow.send(request);

  const results = (
    response.body as { json: { results: Record<string, string> } }
  ).json.results;
  const raw = JSON.parse(results.raw);
  const urlencoded = JSON.parse(results.urlencoded);
  const graphql = JSON.parse(results.graphql);
  const formdata = JSON.parse(results.formdata);

  expect(response.statusCode).toBe(200);
  expect(raw.data).toBe(rawValue);
  expect(urlencoded.data).toBe("a=1&b=2");
  expect(graphql.json).toMatchObject({
    query: "{ __typename }",
    variables: {},
  });
  expect(formdata.data).toContain("--X-INSOMNIA-BOUNDARY");
  expect(formdata.data).toContain('Content-Disposition: form-data; name="c"');
  expect(formdata.data).toContain("3");
  expect(formdata.data.trimEnd()).toMatch(/--X-INSOMNIA-BOUNDARY--$/);
});
