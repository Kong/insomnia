import { faker } from '@faker-js/faker';
import { HttpMethod } from '@package/enums/http-method';
import { DEFAULT_TIMEOUT, HTTP_SERVER, test, WS_SERVER } from "@package/misc/fixtures";
import { Collection } from '@package/models/collection';
import { EnvironmentKvPairDataType } from '@package/models/environment';
import { Folder } from '@package/models/folder';
import { expect } from "@playwright/test";

test('Verify a Cloud Sync collection committed with every document type shows no unknown fields or unsupported warnings when each document is edited and committed again', async ({
  user,
}) => {
  // Creates every document type and commits each one twice, which alone takes most of the default 90s.
  test.setTimeout(240_000);
  const {
    workspaceFlow,
    folderFlow,
    httpRequestFlow,
    graphqlRequestFlow,
    grpcRequestFlow,
    webSocketRequestFlow,
    socketIoRequestFlow,
    cookieFlow,
  } = user.flowManager;
  const { cloudSyncPage, environmentPage, cloudSyncCommitDialogPage } = user.pageManager;

  const project = await workspaceFlow.getProject({ name: 'Personal Workspace' });
  const collectionName = faker.string.alphanumeric(10);
  const collection = await workspaceFlow.createCollection(project!, new Collection(collectionName));
  const folder = await folderFlow.create(collection as Collection, new Folder(faker.string.alphanumeric(10)));
  const httpRequest = await httpRequestFlow.create(collection as Collection, {
    name: faker.string.alphanumeric(10),
    url: `${HTTP_SERVER}/get`,
    method: HttpMethod.Get,
  });
  const graphqlRequest = await graphqlRequestFlow.create(collection as Collection, {
    name: faker.string.alphanumeric(10),
    url: `${HTTP_SERVER}/graphql`,
    method: HttpMethod.Post,
  });
  const grpcRequest = await grpcRequestFlow.create(collection as Collection, {
    name: faker.string.alphanumeric(10),
    url: 'localhost:9000',
  });
  const webSocketRequest = await webSocketRequestFlow.create(collection as Collection, {
    name: faker.string.alphanumeric(10),
    url: WS_SERVER,
  });
  const socketIoRequest = await socketIoRequestFlow.create(collection as Collection, {
    name: faker.string.alphanumeric(10),
    url: HTTP_SERVER,
  });
  await cookieFlow.link(collection as Collection, [
    { key: faker.string.alpha(6), value: faker.string.alpha(6), domain: 'localhost', path: '/' },
  ]);
  await environmentPage.openCollectionEnvironmentEditor();
  await environmentPage.addCollectionEnvironmentVariable({
    id: '',
    name: faker.string.alpha(8),
    value: faker.string.alpha(8),
    type: EnvironmentKvPairDataType.STRING,
  });

  await cloudSyncPage.openCommitDialog();
  const initialChangeNames = await cloudSyncCommitDialogPage.getChangeNames();
  await cloudSyncCommitDialogPage.closeCommitDialog();
  for (const name of initialChangeNames) {
    await cloudSyncPage.openCommitDialog();
    await cloudSyncCommitDialogPage.commit(name, faker.lorem.sentence());
  }

  const renamedRequests = [httpRequest, graphqlRequest, grpcRequest, webSocketRequest, socketIoRequest];
  const renamedNames: string[] = [];
  for (const request of renamedRequests) {
    const renamed = faker.string.alphanumeric(10);
    await workspaceFlow.renameRequest(request, renamed);
    renamedNames.push(renamed);
  }
  const renamedCollectionName = faker.string.alphanumeric(10);
  await workspaceFlow.renameCollection(collection as Collection, renamedCollectionName);
  await folderFlow.setScripts(folder, { preRequest: faker.string.alpha(10) });
  await cookieFlow.link(collection as Collection, [
    { key: faker.string.alpha(6), value: faker.string.alpha(6), domain: 'localhost', path: '/' },
  ]);
  await environmentPage.openCollectionEnvironmentEditor();
  await environmentPage.addCollectionEnvironmentVariable({
    id: '',
    name: faker.string.alpha(8),
    value: faker.string.alpha(8),
    type: EnvironmentKvPairDataType.STRING,
  });

  await cloudSyncPage.openCommitDialog();
  const editedChangeNames = await cloudSyncCommitDialogPage.getChangeNames();
  const rowWarnings: Record<string, { unknownFields: string; unsupported: string; banner: boolean; error: string }> = {};
  for (const name of editedChangeNames) {
    await cloudSyncCommitDialogPage.openChangeDiff(name);
    rowWarnings[name] = {
      unknownFields: await cloudSyncCommitDialogPage.getUnknownFieldsIconTooltip(name),
      unsupported: await cloudSyncCommitDialogPage.getUnsupportedItemIconTooltip(name),
      banner: await cloudSyncCommitDialogPage.isUnknownFieldsDiffWarningVisible(),
      error: await cloudSyncCommitDialogPage.getUnsupportedDocDiffErrorText(),
    };
  }
  await cloudSyncCommitDialogPage.closeCommitDialog();
  for (const name of editedChangeNames) {
    await cloudSyncPage.openCommitDialog();
    await cloudSyncCommitDialogPage.commit(name, faker.lorem.sentence());
  }

  expect(initialChangeNames).toEqual(
    expect.arrayContaining([folder.name, ...renamedRequests.map((request) => request.name), 'Base Environment']),
  );
  expect(editedChangeNames).toEqual(
    expect.arrayContaining([...renamedNames, renamedCollectionName, folder.name, 'Base Environment']),
  );
  expect(Object.values(rowWarnings)).toEqual(
    editedChangeNames.map(() => ({ unknownFields: '', unsupported: '', banner: false, error: '' })),
  );
  await expect.poll(() => cloudSyncPage.isCommitDisabled(), { timeout: DEFAULT_TIMEOUT }).toBe(true);
});
