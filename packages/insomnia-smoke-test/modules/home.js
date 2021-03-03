import * as dropdown from '../modules/dropdown';
import * as modal from '../modules/modal';
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

export const openDocumentWithTitle = async (app, text) => {
  let item;
  await app.client.waitUntil(async () => {
    const items = await app.client.$$('.document-listing__body div[class^=card__CardBody]');
    item = await findAsync(items, async i => (await i.getText()) === text);
    return !!item;
  });
  await item.waitForDisplayed();
  await item.click();

  await debug.pageDisplayed(app);
};

export const expectTotalDocuments = async (app, count) => {
  await app.client.waitUntilTextExists('.document-listing__footer', `${count} Documents`);
};

export const openDocumentMenuDropdown = async app => {
  const dropdown = await app.client.react$('DocumentCardDropdown');
  await dropdown.click();
  return dropdown;
};

export const createNewCollection = async (app, name = 'collection') => {
  const button = await app.client.$('button*=Create');
  await button.waitForClickable();
  await button.click();

  await dropdown.clickDropdownItemByText(app.client, 'Request Collection', true);

  const collectionName = `${name}-${faker.lorem.slug()}`;
  await modal.waitUntilOpened(app, { title: 'Create New Collection' });
  await modal.typeIntoModalInput(app, collectionName);
  await modal.clickModalFooterByText(app, 'Create');
  return collectionName;
};
