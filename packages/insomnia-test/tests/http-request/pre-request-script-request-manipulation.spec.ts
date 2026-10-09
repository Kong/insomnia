import { faker } from '@faker-js/faker';

import { HttpMethod } from '../../enums/http-method';
import { ProjectType } from '../../enums/project-types';
import { expect, HTTP_SERVER, test } from '../../misc/fixtures';
import { Collection } from '../../models/collection';
import { Project } from '../../models/project';

const url = `${HTTP_SERVER}/post`;

test('Verify pre-request script manipulates request headers, query params and body via insomnia.request', async ({
  user,
}) => {
  const { httpRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const collection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)));

  const headerValue = faker.string.alphanumeric(10);
  const rawContent = faker.string.alphanumeric(10);
  const upsertedValue = faker.string.alphanumeric(10);
  const addedParam = faker.string.alphanumeric(10);
  const updatedParam = faker.string.alphanumeric(10);
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url: `${url}?removeMe=1&keepMe=2`,
    preRequestScript: `
      const { Header } = require('insomnia-collection');
      insomnia.request.headers.add(new Header({ key: 'X-Hello', value: '${headerValue}' }));
      insomnia.request.headers.add(new Header({ key: 'X-Remove', value: 'gone' }));
      insomnia.request.headers.upsert({ key: 'X-Upsert', value: '${upsertedValue}' });
      insomnia.request.headers.remove((header) => header.key === 'X-Remove');
      insomnia.request.url.addQueryParams('added=${addedParam}');
      insomnia.request.url.removeQueryParams('removeMe');
      insomnia.request.url.removeQueryParams('keepMe');
      insomnia.request.url.addQueryParams('keepMe=${updatedParam}');
      insomnia.request.body.update({ mode: 'raw', raw: '${rawContent}' });
    `,
  });
  const response = await httpRequestFlow.send(request);

  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({
    data: rawContent,
    args: { added: addedParam, keepMe: updatedParam },
    headers: expect.objectContaining({
      'x-hello': headerValue,
      'x-upsert': upsertedValue,
    }),
  });
  expect((response.body as { args: Record<string, string>; headers: object }).args).not.toHaveProperty('removeMe');
  expect((response.body as { args: Record<string, string>; headers: object }).headers).not.toHaveProperty('x-remove');
});

test('Verify pre-request script sets bearer auth via insomnia.request.auth', async ({ user }) => {
  const { httpRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const collection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)));

  const token = faker.string.alphanumeric(10);
  const prefix = faker.string.alpha(8);
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    preRequestScript: `
      insomnia.request.auth.update({
        type: 'bearer',
        bearer: [
          { key: 'token', value: '${token}' },
          { key: 'prefix', value: '${prefix}' },
        ],
      }, 'bearer');
    `,
  });
  const response = await httpRequestFlow.send(request);

  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({
    headers: expect.objectContaining({
      authorization: `${prefix} ${token}`,
    }),
  });
});

test('Verify pre-request script sets basic auth via insomnia.request.auth', async ({ user }) => {
  const { httpRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const collection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)));

  const username = faker.string.alphanumeric(10);
  const password = faker.string.alphanumeric(10);
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    preRequestScript: `
      insomnia.request.auth.update({
        type: 'basic',
        basic: [
          { key: 'username', value: '${username}' },
          { key: 'password', value: '${password}' },
        ],
      }, 'basic');
    `,
  });
  const response = await httpRequestFlow.send(request);

  const expectedEncodedCredentials = Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({
    headers: expect.objectContaining({
      authorization: `Basic ${expectedEncodedCredentials}`,
    }),
  });
});

test('Verify pre-request script applies apikey, AWS v4, Hawk and OAuth 1.0 auth via insomnia.request.auth', async ({
  user,
}) => {
  const { httpRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const collection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)));

  const apiKeyName = faker.string.alpha(8);
  const apiKeyValue = faker.string.alphanumeric(10);
  const accessKey = faker.string.alphanumeric(10);
  const secretKey = faker.string.alphanumeric(20);
  const region = faker.helpers.arrayElement(['us-east-1', 'eu-west-1']);
  const service = faker.string.alpha(6);
  const hawkId = faker.string.alphanumeric(10);
  const hawkKey = faker.string.alphanumeric(20);
  const consumerKey = faker.string.alphanumeric(10);
  const consumerSecret = faker.string.alphanumeric(10);

  const authScripts = {
    apiKeyHeader: `insomnia.request.auth.update({ type: 'apikey', apikey: [{ key: 'key', value: '${apiKeyName}' }, { key: 'value', value: '${apiKeyValue}' }, { key: 'in', value: 'header' }] }, 'apikey');`,
    apiKeyQuery: `insomnia.request.auth.update({ type: 'apikey', apikey: [{ key: 'key', value: '${apiKeyName}' }, { key: 'value', value: '${apiKeyValue}' }, { key: 'in', value: 'queryParams' }] }, 'apikey');`,
    awsV4: `insomnia.request.auth.update({ type: 'awsv4', awsv4: [{ key: 'accessKey', value: '${accessKey}' }, { key: 'secretKey', value: '${secretKey}' }, { key: 'region', value: '${region}' }, { key: 'service', value: '${service}' }] }, 'awsv4');`,
    hawk: `insomnia.request.auth.update({ type: 'hawk', hawk: [{ key: 'authId', value: '${hawkId}' }, { key: 'authKey', value: '${hawkKey}' }, { key: 'algorithm', value: 'sha256' }] }, 'hawk');`,
    oauth1: `insomnia.request.auth.update({ type: 'oauth1', oauth1: [{ key: 'consumerKey', value: '${consumerKey}' }, { key: 'consumerSecret', value: '${consumerSecret}' }, { key: 'signatureMethod', value: 'HMAC-SHA1' }] }, 'oauth1');`,
  };
  const responses: Record<string, Awaited<ReturnType<typeof httpRequestFlow.send>>> = {};
  for (const [authName, preRequestScript] of Object.entries(authScripts)) {
    const request = await httpRequestFlow.create(collection, {
      name: faker.string.alphanumeric(10),
      method: HttpMethod.Post,
      url,
      preRequestScript,
    });
    responses[authName] = await httpRequestFlow.send(request);
  }

  const headersOf = (name: string) => (responses[name].body as { headers: Record<string, string> }).headers;
  expect(headersOf('apiKeyHeader')).toMatchObject({
    [apiKeyName.toLowerCase()]: apiKeyValue,
  });
  expect(responses.apiKeyQuery.body).toMatchObject({
    args: { [apiKeyName]: apiKeyValue },
  });
  expect(headersOf('awsV4').authorization).toContain(`AWS4-HMAC-SHA256 Credential=${accessKey}/`);
  expect(headersOf('awsV4').authorization).toContain(`/${region}/${service}/`);
  expect(headersOf('hawk').authorization).toContain(`Hawk id="${hawkId}"`);
  expect(headersOf('oauth1').authorization).toContain(`oauth_consumer_key="${consumerKey}"`);
  expect(headersOf('oauth1').authorization).toContain('oauth_signature_method="HMAC-SHA1"');
});
