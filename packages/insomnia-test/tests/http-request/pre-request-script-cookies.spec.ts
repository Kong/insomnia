import { faker } from '@faker-js/faker';

import { HttpMethod } from '../../enums/http-method';
import { ProjectType } from '../../enums/project-types';
import { expect, HTTP_SERVER,test } from '../../misc/fixtures';
import { Collection } from '../../models/collection';
import { Project } from '../../models/project';

test('Verify pre-request script manages cookies via insomnia.cookies.jar() and they are sent with the request', async ({
  user,
}) => {
  const { httpRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const collection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)));

  const keptName = faker.string.alpha(8);
  const keptValue = faker.string.alphanumeric(10);
  const unsetName = faker.string.alpha(9);
  const objectName = faker.string.alpha(10);
  const objectValue = faker.string.alphanumeric(10);
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/cookies`,
    preRequestScript: `
      const jar = insomnia.cookies.jar();
      const call = (fn, ...args) => new Promise((resolve, reject) => fn.call(jar, ...args, (err, res) => err ? reject(err) : resolve(res)));
      await call(jar.set, '${HTTP_SERVER}', '${keptName}', { key: '${keptName}', value: '${keptValue}', domain: 'localhost' });
      await call(jar.set, '${HTTP_SERVER}', '${unsetName}', { key: '${unsetName}', value: 'temporary', domain: 'localhost' });
      await call(jar.set, '${HTTP_SERVER}', '${objectName}', { key: '${objectName}', value: '${objectValue}', domain: 'localhost' });
      await call(jar.unset, '${HTTP_SERVER}', '${unsetName}');
    `,
  });
  const response = await httpRequestFlow.send(request);

  expect(response.statusCode).toBe(200);
  expect(response.body).toEqual({
    cookies: { [keptName]: keptValue, [objectName]: objectValue },
  });
});
