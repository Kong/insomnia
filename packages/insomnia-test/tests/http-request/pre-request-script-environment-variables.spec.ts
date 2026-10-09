import { faker } from "@faker-js/faker";

import { ContentType } from "../../enums/content-type";
import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const url = `${HTTP_SERVER}/post`;

test("Verify pre-request script overrides base environment values through the environment chain and persists set/get variables", async ({
  user,
}) => {
  const { httpRequestFlow, workspaceFlow, environmentFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const baseEnvironment = await environmentFlow.create(project, {
    name: faker.string.alphanumeric(10),
  });
  const subEnvironment = await environmentFlow.create(baseEnvironment, {
    name: faker.string.alphanumeric(10),
  });
  await environmentFlow.link(collection, subEnvironment);

  const fallbackValue = faker.string.alphanumeric(10);
  const baseScriptValue = faker.string.alphanumeric(10);
  const envScriptValue = faker.string.alphanumeric(10);
  const preDefinedValue = faker.string.alphanumeric(10);
  const varStr = faker.string.alphanumeric(10);
  const varNum = faker.number.int({ min: 1, max: 1000 });
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    body: {
      mimeType: ContentType.JSON,
      text: `{"fallbackToBase": "{{ fallbackToBase }}", "scriptValue": "{{ scriptValue }}", "preDefinedValue": "{{ preDefinedValue }}", "varStr": "{{ varStr }}", "varNum": {{ varNum }}, "varBool": {{ varBool }}}`,
    },
    preRequestScript: `
      insomnia.baseEnvironment.set('fallbackToBase', '${fallbackValue}');
      insomnia.baseEnvironment.set('scriptValue', '${baseScriptValue}');
      insomnia.environment.set('scriptValue', '${envScriptValue}');
      insomnia.baseEnvironment.set('preDefinedValue', '${preDefinedValue}');

      insomnia.variables.set('varStr', '${varStr}');
      insomnia.variables.set('varNum', ${varNum});
      insomnia.variables.set('varBool', true);
      insomnia.environment.set('varStr', insomnia.variables.get('varStr'));
      insomnia.environment.set('varNum', insomnia.variables.get('varNum'));
      insomnia.environment.set('varBool', insomnia.variables.get('varBool'));
    `,
  });
  const response = await httpRequestFlow.send(request);

  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({
    json: {
      fallbackToBase: fallbackValue,
      scriptValue: envScriptValue,
      preDefinedValue: preDefinedValue,
      varStr,
      varNum,
      varBool: true,
    },
  });
});
