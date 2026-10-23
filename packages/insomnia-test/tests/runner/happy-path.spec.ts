import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const url = `${HTTP_SERVER}/post`;
const unreachableUrl = "http://localhost:59999/nope";
const passingScript =
  "insomnia.test('status is 200', () => { insomnia.expect(insomnia.response.code).to.equal(200); });";
const failingScript =
  "insomnia.test('status is 999', () => { insomnia.expect(insomnia.response.code).to.equal(999); });";
const iterations = 3;

test("Verify Running a Collection via Run Collection Context Menu", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const requestA = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    afterResponseScript: passingScript,
  });
  const requestB = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    afterResponseScript: failingScript,
  });
  const requestC = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: unreachableUrl,
  });

  const { testResultCount, iterationResults } = await workspaceFlow.run(
    collection,
    { iterations, delay: 0, keepLogs: true, bail: false },
  );

  expect(testResultCount).toEqual({
    passed: iterations,
    total: iterations * 2,
  });
  expect([...iterationResults.keys()]).toEqual(
    expect.arrayContaining(["All", "Passed", "Failed", "Skipped"]),
  );
  const allResults = iterationResults.get("All")!;
  expect(allResults).toHaveLength(iterations);
  for (let i = 0; i < iterations; i++) {
    expect(allResults[i].iteration).toBe(i + 1);
    expect(allResults[i].results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: requestA!.name, status: "200 OK" }),
        expect.objectContaining({ name: requestB!.name, status: "200 OK" }),
        expect.objectContaining({
          name: requestC!.name,
          status: "ERROR",
          durationMs: 0,
          bytes: 0,
        }),
      ]),
    );
    for (const result of allResults[i].results) {
      if (result.name === requestC!.name) continue;
      expect(result.durationMs).toBeGreaterThan(0);
      expect(result.bytes).toBeGreaterThan(0);
    }
  }
  // "Passed"/"Failed" narrow each iteration down to the request whose
  // script test(s) matched that outcome — requestA's test passes,
  // requestB's fails; requestC never runs a test (it errors before any
  // response), so it never appears under either filter.
  const passedResults = iterationResults.get("Passed")!;
  expect(passedResults).toHaveLength(iterations);
  for (const iteration of passedResults) {
    expect(iteration.results).toEqual([
      expect.objectContaining({ name: requestA!.name, status: "200 OK" }),
    ]);
  }
  const failedResults = iterationResults.get("Failed")!;
  expect(failedResults).toHaveLength(iterations);
  for (const iteration of failedResults) {
    expect(iteration.results).toEqual([
      expect.objectContaining({ name: requestB!.name, status: "200 OK" }),
    ]);
  }
  // "Skipped" is for requests with an `insomnia.test.skip()` block, which
  // none of these requests use — not requestC's network error, which
  // never reaches a test at all. No iteration renders here.
  expect(iterationResults.get("Skipped")).toEqual([]);
});
