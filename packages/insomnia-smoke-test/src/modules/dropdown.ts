import findAsync from './find-async';

const findDropdownItemWithText = async (parent, text) => {
  let item;
  await parent.waitUntil(async () => {
    const items = await parent.react$$('DropdownItem');
    item = await findAsync(items, async i => (await i.getText()) === text);
    return !!item;
  });
  return item;
};

export const clickDropdownItemByText = async (parent, text) => {
  const item = await findDropdownItemWithText(parent, text);
  await item.waitForDisplayed();
  await item.click();
};

export const clickOpenDropdownItemByText = async (app, text) => {
  const item = await app.client
    .$('.dropdown__menu[aria-hidden=false]')
    .then(e => e.$(`button*=${text}`));
  await item.waitForDisplayed();
  await item.click();
};
