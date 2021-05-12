import * as dropdown from './dropdown';
import * as modal from './modal';
import { findAsync } from './find-async';
import * as debug from './debug';
import faker from 'faker';
import { Application } from 'spectron';

export const documentListingShown = async (app: Application) => {
  const item = await app.client.$('.document-listing');
  await item.waitForExist();
};

export const expectDocumentWithTitle = async (app: Application, title: string) => {
  await app.client.waitUntilTextExists('.document-listing__body', title);
};

export const findCardWithTitle = async (app: Application, text: string) => {
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

// @ts-expect-error -- TSCONVERSION
export const cardHasBadge = async (card, text: string) => {
  const badge = await card.$('.header-item.card-badge');
  expect(await badge.getText()).toBe(text);
};

export const openDocumentWithTitle = async (app: Application, text: string) => {
  const card = await findCardWithTitle(app, text);
  // @ts-expect-error -- TSCONVERSION
  await card.waitForDisplayed();
  // @ts-expect-error -- TSCONVERSION
  await card.click();

  await debug.pageDisplayed(app);
};

export const expectTotalDocuments = async (app: Application, count: number) => {
  const label = count > 1 ? 'Documents' : 'Document';
  await app.client.waitUntilTextExists('.document-listing__footer', `${count} ${label}`);
};

// @ts-expect-error -- TSCONVERSION don't happen to have this type handy (as far as I understand)
export const openDocumentMenuDropdown = async card => {
  const dropdown = await card.react$('DocumentCardDropdown');
  await dropdown.click();
};

const openCreateDropdown = async (app: Application) => {
  const button = await app.client.$('button*=Create');
  await button.waitForClickable();
  await button.click();
};

export const createNewCollection = async (app: Application, prefix = 'coll') => {
  await openCreateDropdown(app);

  await dropdown.clickDropdownItemByText(app.client, 'Request Collection');

  const collectionName = `${prefix}-${faker.lorem.slug()}`;
  // @ts-expect-error -- TSCONVERSION
  await modal.waitUntilOpened(app, { title: 'Create New Request Collection' });
  await modal.typeIntoModalInput(app, collectionName);
  await modal.clickModalFooterByText(app, 'Create');
  return collectionName;
};

export const createNewDocument = async (app: Application, prefix = 'doc') => {
  await openCreateDropdown(app);

  await dropdown.clickDropdownItemByText(app.client, 'Design Document');

  const documentName = `${prefix}-${faker.lorem.slug()}`;
  // @ts-expect-error -- TSCONVERSION
  await modal.waitUntilOpened(app, { title: 'Create New Design Document' });
  await modal.typeIntoModalInput(app, documentName);
  await modal.clickModalFooterByText(app, 'Create');
  return documentName;
};

export const importFromClipboard = async (app: Application) => {
  await openCreateDropdown(app);

  await dropdown.clickDropdownItemByText(app.client, 'Clipboard');
};
