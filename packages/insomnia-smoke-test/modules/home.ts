import faker from 'faker';
import { Application } from 'spectron';

import * as debug from './debug';
import * as design from './design';
import * as dropdown from './dropdown';
import * as modal from './modal';

export const documentListingShown = async app => {
  const item = await app.client.$('.document-listing');
  await item.waitForExist();
};

export const expectDocumentWithTitle = async (app, title) => {
  await app.client.waitUntilTextExists('.document-listing__body', title);
};

export const findCardWithTitle = async (app: Application, text: string) => {
  const cards = await app.client.react$$('Card');

  for (const card of cards) {
    const cardTitle = await card.$('.title');

    const title = await cardTitle.getText();
    if (title === text) {
      return card;
    }
  }

  throw new Error(`Card with title: ${text} not found`);
};

export const cardHasBadge = async (card, text) => {
  const badge = await card.$('.header-item.card-badge');
  expect(await badge.getText()).toBe(text);
};

export const openDocumentWithTitle = async (app: Application, text: string) => {
  const card = await findCardWithTitle(app, text);
  const cardBadge = await card.$('.header-item.card-badge');
  const isCollection = await cardBadge.getText() === 'Collection';
  await card.waitForDisplayed();
  await card.click();

  if (isCollection) {
    await debug.pageDisplayed(app);
  } else {
    await design.goToActivity(app, 'spec');
    await design.pageDisplayed(app);
  }
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
