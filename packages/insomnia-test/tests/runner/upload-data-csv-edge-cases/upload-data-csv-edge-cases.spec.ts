import path from "node:path";

import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../../enums/http-method";
import { ProjectType } from "../../../enums/project-types";
import { expect, HTTP_SERVER, test } from "../../../misc/fixtures";
import { Collection } from "../../../models/collection";
import { Project } from "../../../models/project";

const url = `${HTTP_SERVER}/post`;

test("Verify a quoted CSV field containing a comma is uploaded as a single value without shifting later columns", async ({ user }) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    afterResponseScript: `
      insomnia.test('quoted comma field is preserved as a single value', () => {
        insomnia.expect(insomnia.iterationData.get('origin')).to.equal('ORD,YVR');
        insomnia.expect(insomnia.iterationData.get('destination')).to.equal('SEA');
        insomnia.expect(insomnia.iterationData.get('priority')).to.equal('high');
      });
    `,
  });

  const result = await workspaceFlow.run(collection, {
    dataFilePath: path.join(__dirname, "quoted-comma.csv"),
  });

  expect(result.testResultCount).toEqual({ passed: 1, total: 1 });
});

test("Verify escaped double quotes inside a quoted CSV field are unescaped to a literal quote", async ({ user }) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    afterResponseScript: `
      insomnia.test('escaped quotes are unescaped to a literal quote', () => {
        insomnia.expect(insomnia.iterationData.get('note')).to.equal('She said "hello"');
      });
    `,
  });

  const result = await workspaceFlow.run(collection, {
    dataFilePath: path.join(__dirname, "escaped-quotes.csv"),
  });

  expect(result.testResultCount).toEqual({ passed: 1, total: 1 });
});

test("Verify a CSV row with fewer cells than the header defaults the missing trailing cell to an empty string", async ({ user }) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const expectedRows = [
    { name: "Alice", email: "alice@example.com" },
    { name: "Bob", email: "" },
  ];

  await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    afterResponseScript: `
      const expected = ${JSON.stringify(expectedRows)}[insomnia.info.iteration - 1];
      insomnia.test('missing trailing cell defaults to an empty string', () => {
        insomnia.expect(insomnia.iterationData.get('name')).to.equal(expected.name);
        insomnia.expect(insomnia.iterationData.get('email')).to.equal(expected.email);
      });
    `,
  });

  const result = await workspaceFlow.run(collection, {
    dataFilePath: path.join(__dirname, "missing-trailing-cell.csv"),
  });

  expect(result.testResultCount).toEqual({
    passed: expectedRows.length,
    total: expectedRows.length,
  });
});

test("Verify a newline inside a quoted CSV field is preserved as part of a single value instead of splitting into an extra row", async ({ user }) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    afterResponseScript: `
      insomnia.test('newline inside a quoted field is preserved as a single value', () => {
        insomnia.expect(insomnia.iterationData.get('name')).to.equal('Alice');
        insomnia.expect(insomnia.iterationData.get('note')).to.equal('Hello\\nWorld');
      });
    `,
  });

  const result = await workspaceFlow.run(collection, {
    dataFilePath: path.join(__dirname, "newline-in-quoted-field.csv"),
  });

  expect(result.testResultCount).toEqual({ passed: 1, total: 1 });
  expect(result.iterationResults.get("All")?.length).toBe(1);
});

test("Verify a trailing blank line in the CSV file does not produce an extra bogus iteration", async ({ user }) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    afterResponseScript: `
      insomnia.test('iteration data still resolves to the only real row', () => {
        insomnia.expect(insomnia.iterationData.get('name')).to.equal('Alice');
      });
    `,
  });

  const result = await workspaceFlow.run(collection, {
    dataFilePath: path.join(__dirname, "trailing-blank-line.csv"),
  });

  expect(result.testResultCount).toEqual({ passed: 1, total: 1 });
  expect(result.iterationResults.get("All")?.length).toBe(1);
});
