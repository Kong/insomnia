import * as dropdown from './dropdown';
import * as modal from './modal';
import findAsync from './find-async';
import * as debug from './debug';
import faker from 'faker';

export const documentListingShown = async app => {
  const item = await app.client.$('.document-listing');
  await item.waitForExist();
};

export const expectDocumentWithTitle = async (app, title) => {
  await app.client.waitUntilTextExists('.document-listing__body', title);
};

export const findCardWithTitle = async (app, text) => {
  let card;
  await app.client.waitUntil(async () => {
    const cards = await app.client.react$$('Card');
    card = await findAsync(
      cards,
      async i => (await i.react$('CardBody').then(e => e.$('.title')).then(e => e.getText())) === text,
    );
    return !!card;
  });
  return card;
};

export const cardHasBadge = async (card, text) => {
  const badge = await card.$('.header-item.card-badge');
  expect(await badge.getText()).toBe(text);
};

export const openDocumentWithTitle = async (app, text) => {
  const card = await findCardWithTitle(app, text);
  await card.waitForDisplayed();
  await card.click();

  await debug.pageDisplayed(app);
};

export const expectTotalDocuments = async (app, count) => {
  const label = count > 1 ? 'Documents' : 'Document';
  await app.client.waitUntilTextExists('.document-listing__footer', `${count} ${label}`);
};

export const openWorkspaceCardDropdown = async card => {
  const dropdown = await card.react$('WorkspaceCardDropdown');
  await dropdown.click();
};

const openCreateDropdown = async app => {
  const button = await app.client.$('button*=Create');
  await button.waitForClickable();
  await button.click();
};

export const createNewCollection = async (app, prefix = 'coll') => {
  await openCreateDropdown(app);

  await dropdown.clickDropdownItemByText(app.client, 'Request Collection');

  const collectionName = `${prefix}-${faker.lorem.slug()}`;
  await modal.waitUntilOpened(app, { title: 'Create New Request Collection' });
  await modal.typeIntoModalInput(app, collectionName);
  await modal.clickModalFooterByText(app, 'Create');
  return collectionName;
};

export const createNewDocument = async (app, prefix = 'doc') => {
  await openCreateDropdown(app);

  await dropdown.clickDropdownItemByText(app.client, 'Design Document');

  const documentName = `${prefix}-${faker.lorem.slug()}`;
  await modal.waitUntilOpened(app, { title: 'Create New Design Document' });
  await modal.typeIntoModalInput(app, documentName);
  await modal.clickModalFooterByText(app, 'Create');
  return documentName;
};

export const importFromClipboard = async app => {
  await openCreateDropdown(app);

  await dropdown.clickDropdownItemByText(app.client, 'Clipboard');
};
