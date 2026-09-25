import { faker } from "@faker-js/faker";

import { ContentType } from "../../enums/content-type";
import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const url = `${HTTP_SERVER}/post`;

test("Verify pending async work in a pre-request script (Promise, setTimeout, sendRequest callback/await) is settled before the request is sent", async ({
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

  const marker = faker.string.alphanumeric(10);
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    body: {
      mimeType: ContentType.JSON,
      text: `{"asyncDoneViaPromise": {{ asyncDoneViaPromise }}, "asyncDoneViaTimeout": {{ asyncDoneViaTimeout }}, "asyncDoneViaCallback": {{ asyncDoneViaCallback }}, "bodyFromAwait": {{ bodyFromAwait }}, "bodyFromCallback": {{ bodyFromCallback }}}`,
    },
    preRequestScript: `
      new Promise((resolve) => {
        setTimeout(() => {
          insomnia.environment.set('asyncDoneViaPromise', true);
          resolve();
        }, 500);
      });

      setTimeout(() => {
        insomnia.environment.set('asyncDoneViaTimeout', true);
      }, 500);

      insomnia.sendRequest({ url: '${url}', method: 'POST' }, (err, resp) => {
        if (err != null) {
          throw err;
        } else {
          insomnia.environment.set('asyncDoneViaCallback', true);
        }
      });

      let respFromCallback;
      const respFromAwait = await insomnia.sendRequest({
        url: '${url}',
        method: 'POST',
        body: { mode: 'raw', raw: '${marker}' },
      }, (err, resp) => {
        if (err != null) {
          throw err;
        } else {
          respFromCallback = resp;
        }
      });
      insomnia.environment.set('bodyFromAwait', respFromAwait.body);
      insomnia.environment.set('bodyFromCallback', respFromCallback.body);
    `,
  });
  const response = await httpRequestFlow.send(request);

  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({
    json: {
      asyncDoneViaPromise: true,
      asyncDoneViaTimeout: true,
      asyncDoneViaCallback: true,
      bodyFromAwait: expect.objectContaining({ data: marker }),
      bodyFromCallback: expect.objectContaining({ data: marker }),
    },
  });
});
