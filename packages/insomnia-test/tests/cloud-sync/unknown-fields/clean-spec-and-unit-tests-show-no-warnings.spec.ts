import { faker } from '@faker-js/faker';
import { expect } from "@playwright/test";

import { DEFAULT_TIMEOUT, test } from "../../../misc/fixtures";
import { Collection, Info, Specification } from '../../../models/collection';
import { commitEachChange, NO_ROW_WARNINGS, readRowWarnings } from './helpers';

const buildSpec = () =>
  new Specification(new Info(faker.company.name(), faker.system.semver(), faker.lorem.sentence()), {
    [`/${faker.word.sample()}`]: {
      get: { operationId: faker.string.alpha(8), responses: { '200': { description: 'OK' } } },
    },
  });

test('Verify a Cloud Sync collection with an API spec and unit tests committed and then edited shows no unknown fields or unsupported warnings and commits without confirmation', async ({
  user,
}) => {
  const { workspaceFlow } = user.flowManager;
  const { cloudSyncPage, workspacePage } = user.pageManager;

  const project = await workspaceFlow.getProject({ name: 'Personal Workspace' });
  const collection = await workspaceFlow.createCollection(project!, new Collection(faker.string.alphanumeric(10), buildSpec()));
  const suiteName = faker.string.alphanumeric(10);
  const testName = faker.string.alphanumeric(10);
  await workspaceFlow.createTestSuite(collection, suiteName);
  const suite = await workspaceFlow.getTestSuite(collection, suiteName);
  await workspaceFlow.createUnitTest(suite, testName);
  await cloudSyncPage.openCommitDialog();
  const initialChangeNames = await cloudSyncPage.getChangeNames();
  await cloudSyncPage.closeCommitDialog();
  await commitEachChange(cloudSyncPage, initialChangeNames);

  await workspaceFlow.fillSpecification(collection, buildSpec());
  await workspaceFlow.getTestSuite(collection, suiteName);
  await workspacePage.renameUnitTest(testName, faker.string.alphanumeric(10));
  await workspacePage.renameTestSuite(suiteName, faker.string.alphanumeric(10));
  await cloudSyncPage.openCommitDialog();
  const editedChangeNames = await cloudSyncPage.getChangeNames();
  const rowWarnings = await readRowWarnings(cloudSyncPage, editedChangeNames);
  await cloudSyncPage.closeCommitDialog();
  await commitEachChange(cloudSyncPage, editedChangeNames);

  expect(initialChangeNames.length).toBeGreaterThan(0);
  expect(editedChangeNames.length).toBeGreaterThan(1);
  expect(rowWarnings).toEqual(editedChangeNames.map(() => NO_ROW_WARNINGS));
  await expect.poll(() => cloudSyncPage.isCommitDisabled(), { timeout: DEFAULT_TIMEOUT }).toBe(true);
});
