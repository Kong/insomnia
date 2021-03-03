import findAsync from './find-async';

const findDropdownItemWithText = async (parent, text, fromComponentLibrary, reverse = false) => {
  let item;
  await parent.waitUntil(async () => {
    const items = fromComponentLibrary
      ? await parent.$$('button[class^=dropdown-item]')
      : await parent.react$$('DropdownItem');
    item = await findAsync(items, async i => (await i.getText()) === text);
    return !!item;
  });
  return item;
};

export const clickDropdownItemByText = async (parent, text, fromComponentLibrary = false) => {
  const item = await findDropdownItemWithText(parent, text, fromComponentLibrary);
  await item.waitForDisplayed();
  await item.click();
};

export const ensureDropdownItemByText = async (parent, text, reverse = false) => {
  await parent.waitUntilTextExists('button[class^=dropdown-item]', text);
  const item = await findDropdownItemWithText(parent, text, true, reverse);
  await item.waitForExist({ reverse });
};

export const clickOpenDropdownItemByText = async (app, text) => {
  const item = await app.client
    .$('.dropdown__menu[aria-hidden=false]')
    .then(e => e.$(`button*=${text}`));
  await item.waitForDisplayed();
  await item.click();
};
