import { faker } from '@faker-js/faker';

import { ContentType } from '../../enums/content-type';
import { HttpMethod } from '../../enums/http-method';
import { ProjectType } from '../../enums/project-types';
import { DEFAULT_TIMEOUT, expect, HTTP_SERVER, test } from '../../misc/fixtures';
import { Collection } from '../../models/collection';
import { Project } from '../../models/project';

const url = `${HTTP_SERVER}/post`;

test('Verify insomnia.test/insomnia.expect report PASS/FAIL results, including a transient variable and insomnia.response accessors', async ({
  user,
}) => {
  const { httpRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const collection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)));

  const transientValue = faker.string.alphanumeric(10);
  const sentValue = faker.string.alphanumeric(10);
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    body: { mimeType: ContentType.JSON, text: `{"sent": "${sentValue}"}` },
    afterResponseScript: `
      insomnia.variables.set('transientVar', '${transientValue}');
      insomnia.test('transient var', () => {
        insomnia.expect(insomnia.variables.get('transientVar')).to.equal('${transientValue}');
      });
      insomnia.test('happyTestInFunc', () => {
        insomnia.expect(200).to.equal(200);
      });
      insomnia.test('response accessors', () => {
        insomnia.expect(insomnia.response.code).to.equal(200);
        insomnia.expect(insomnia.response.status).to.equal('OK');
        insomnia.expect(insomnia.response.json().json.sent).to.equal('${sentValue}');
        insomnia.expect(insomnia.response.text()).to.include('${sentValue}');
        insomnia.expect(insomnia.response.headers.get('Content-Type')).to.include('application/json');
        insomnia.expect(insomnia.response.responseTime).to.be.a('number');
        insomnia.expect(insomnia.response.size().body).to.be.above(0);
      });
      insomnia.test('response assertions', () => {
        insomnia.response.to.have.status(200);
        insomnia.response.to.have.header('Content-Type');
        insomnia.response.to.have.jsonBody('data', '{"sent": "${sentValue}"}');
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
        expect.objectContaining({ name: 'transient var', status: 'PASS' }),
        expect.objectContaining({ name: 'happyTestInFunc', status: 'PASS' }),
        expect.objectContaining({ name: 'response accessors', status: 'PASS' }),
        expect.objectContaining({
          name: 'response assertions',
          status: 'PASS',
        }),
        expect.objectContaining({
          name: 'unhappy tests',
          status: 'FAIL',
          error: expect.stringContaining('AssertionError: expected 199 to equal 200'),
        }),
      ]),
    );
});
