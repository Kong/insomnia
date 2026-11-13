import { faker } from "@faker-js/faker";
import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { HTTP_SERVER, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { EnvironmentKvPairDataType } from "@package/models/environment";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test("Verify query params from the URL, template tags, and the Parameters tab are merged and special characters are escaped correctly", async ({
  user,
}) => {
  const { httpRequestFlow, workspaceFlow, environmentFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const fromUrlValue = faker.string.alphanumeric(10);
  const fromEditorValue = faker.string.alphanumeric(10);
  const environment = await environmentFlow.createBaseEnvironment(project, {
    name: faker.string.alphanumeric(10),
    kvPairData: [
      {
        id: "",
        name: "fromUrlValue",
        value: fromUrlValue,
        type: EnvironmentKvPairDataType.STRING,
        enabled: true,
      },
      {
        id: "",
        name: "fromEditorValue",
        value: fromEditorValue,
        type: EnvironmentKvPairDataType.STRING,
        enabled: true,
      },
    ],
  });
  await environmentFlow.link(collection, environment);

  const spaceValue = `${faker.string.alphanumeric(4)} ${faker.string.alphanumeric(4)}`;
  const ampersandValue = `${faker.string.alphanumeric(4)}&${faker.string.alphanumeric(4)}`;
  const equalsValue = `${faker.string.alphanumeric(4)}=${faker.string.alphanumeric(4)}`;
  const hashValue = `${faker.string.alphanumeric(4)}#${faker.string.alphanumeric(4)}`;
  const chineseValue = `测试${faker.string.alphanumeric(4)}参数`;
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url: `${HTTP_SERVER}/post?key=fromUrl&key={{ fromUrlValue }}`,
  });
  
  await httpRequestFlow.setParamsBulk(request, [
    { name: "key", value: "{{ fromEditorValue }}" },
    { name: "key", value: "/" },
    { name: "space", value: spaceValue },
    { name: "ampersand", value: ampersandValue },
    { name: "equals", value: equalsValue },
    { name: "hash", value: hashValue },
    { name: "chinese", value: chineseValue },
  ]);
  const responseView = await httpRequestFlow.send(request);

  expect(responseView.statusBar.code).toBe(200);
  expect(responseView.preview).toMatchObject({
    args: {
      key: ["fromUrl", fromUrlValue, fromEditorValue, "/"],
      space: spaceValue,
      ampersand: ampersandValue,
      equals: equalsValue,
      hash: hashValue,
      chinese: chineseValue,
    },
  });
});
