import findAsync from './find-async';

export const clickDropdownItemByText = async (dropdown, text, fromComponentLibrary = false) => {
  let item;
  await dropdown.waitUntil(async () => {
    const items = fromComponentLibrary
      ? await dropdown.$$('button[class^=dropdown-item]')
      : await dropdown.react$$('DropdownItem');
    item = await findAsync(items, async i => (await i.getText()) === text);
    return !!item;
  });
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
