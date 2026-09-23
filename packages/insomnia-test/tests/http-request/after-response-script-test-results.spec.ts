import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import {
  DEFAULT_TIMEOUT,
  expect,
  HTTP_SERVER,
  test,
} from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const url = `${HTTP_SERVER}/post`;

test("Verify insomnia.test/insomnia.expect report PASS/FAIL results, including a transient variable set in the same script", async ({
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

  const transientValue = faker.string.alphanumeric(10);
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    afterResponseScript: `
      insomnia.variables.set('transientVar', '${transientValue}');
      insomnia.test('transient var', () => {
        insomnia.expect(insomnia.variables.get('transientVar')).to.equal('${transientValue}');
      });
      insomnia.test('happyTestInFunc', () => {
        insomnia.expect(200).to.equal(200);
      });
      insomnia.test('unhappy tests', () => {
        insomnia.expect(199).to.equal(200);
      });
    `,
  });
  const response = await httpRequestFlow.send(request);

  expect(response.statusCode).toBe(200);
  await expect
    .poll(() => response.tests?.(), { timeout: DEFAULT_TIMEOUT })
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "transient var", status: "PASS" }),
        expect.objectContaining({ name: "happyTestInFunc", status: "PASS" }),
        expect.objectContaining({
          name: "unhappy tests",
          status: "FAIL",
          error: expect.stringContaining(
            "AssertionError: expected 199 to equal 200",
          ),
        }),
      ]),
    );
});
