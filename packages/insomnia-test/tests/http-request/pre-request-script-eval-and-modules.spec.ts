import { faker } from "@faker-js/faker";

import { ContentType } from "../../enums/content-type";
import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const url = `${HTTP_SERVER}/post`;

test("Verify pre-request script can eval() and require Node built-in modules, external modules, and insomnia-collection classes", async ({
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

  const parsedUrl = new URL(
    "https://user:pwd@insomnia.com:6666/p1?q1=a&q2=b#hashcontent",
  );
  const builtinModules = [
    "path",
    "assert",
    "buffer",
    "util",
    "url",
    "punycode",
    "querystring",
    "string_decoder",
    "stream",
    "timers",
    "events",
  ];
  const externalModules = {
    atob: "atob",
    btoa: "btoa",
    chai: "chai",
    cheerio: "cheerio",
    crypto: "crypto-js",
    csv: "csv-parse/lib/sync",
    lodash: "lodash",
    moment: "moment",
    tv4: "tv4",
    uuid: "uuid",
    xml2js: "xml2js",
  };
  const externalModuleKeys = Object.keys(externalModules);
  const propertyId = faker.string.alphanumeric(10);
  const propertyName = faker.string.alphanumeric(10);
  const headerKey = faker.string.alphanumeric(10);
  const headerValue = faker.string.alphanumeric(10);
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    body: {
      mimeType: ContentType.JSON,
      text: `{"evalResult": {{ evalResult }}, "hash": "{{ hash }}", "host": "{{ host }}", "hostname": "{{ hostname }}", "origin": "{{ origin }}", "password": "{{ password }}", "pathname": "{{ pathname }}", "port": "{{ port }}", "protocol": "{{ protocol }}", "search": "{{ search }}", "username": "{{ username }}", "searchParam": "{{ searchParam }}", ${builtinModules.map((m) => `"${m}": {{ ${m} }}`).join(", ")}, ${externalModuleKeys.map((k) => `"${k}": {{ ${k} }}`).join(", ")}, "builtInLodash": {{ builtInLodash }}, "uuidNil": "{{ uuidNil }}", "propJson": {{ propJson }}, "headerJson": {{ headerJson }}}`,
    },
    preRequestScript: `
      const evalResult = eval('8+8');
      insomnia.environment.set('evalResult', evalResult);

      const { URL } = require('url');
      const parsedUrl = new URL('${parsedUrl.href}');
      insomnia.environment.set('hash', parsedUrl.hash);
      insomnia.environment.set('host', parsedUrl.host);
      insomnia.environment.set('hostname', parsedUrl.hostname);
      insomnia.environment.set('origin', parsedUrl.origin);
      insomnia.environment.set('password', parsedUrl.password);
      insomnia.environment.set('pathname', parsedUrl.pathname);
      insomnia.environment.set('port', parsedUrl.port);
      insomnia.environment.set('protocol', parsedUrl.protocol);
      insomnia.environment.set('search', parsedUrl.search);
      insomnia.environment.set('username', parsedUrl.username);
      insomnia.environment.set('searchParam', parsedUrl.searchParams.toString());

      ${builtinModules.map((m) => `insomnia.environment.set('${m}', require('${m}') != null);`).join("\n")}

      ${externalModuleKeys.map((k) => `insomnia.environment.set('${k}', require('${externalModules[k as keyof typeof externalModules]}') != null);`).join("\n")}
      insomnia.environment.set('builtInLodash', _ != null);

      const uuid = require('uuid');
      insomnia.environment.set('uuidNil', uuid.NIL);

      const { Property, Header } = require('insomnia-collection');
      const prop = new Property('${propertyId}', '${propertyName}');
      const header = new Header({ key: '${headerKey}', value: '${headerValue}' });
      insomnia.environment.set('propJson', JSON.stringify(prop.toJSON()));
      insomnia.environment.set('headerJson', JSON.stringify(header.toJSON()));
    `,
  });
  const response = await httpRequestFlow.send(request);

  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({
    json: {
      evalResult: 16,
      hash: parsedUrl.hash,
      host: parsedUrl.host,
      hostname: parsedUrl.hostname,
      origin: parsedUrl.origin,
      password: parsedUrl.password,
      pathname: parsedUrl.pathname,
      port: parsedUrl.port,
      protocol: parsedUrl.protocol,
      search: parsedUrl.search,
      username: parsedUrl.username,
      searchParam: parsedUrl.searchParams.toString(),
      ...Object.fromEntries(builtinModules.map((m) => [m, true])),
      ...Object.fromEntries(externalModuleKeys.map((k) => [k, true])),
      builtInLodash: true,
      uuidNil: "00000000-0000-0000-0000-000000000000",
      propJson: { id: propertyId, name: propertyName, disabled: false },
      headerJson: { key: headerKey, value: headerValue, id: "", name: "" },
    },
  });
});
