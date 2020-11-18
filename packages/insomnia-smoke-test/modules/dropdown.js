import findAsync from './find-async';

export const clickDropdownItemByText = async (dropdown, text) => {
  let item;
  await dropdown.waitUntil(async () => {
    const items = await dropdown.react$$('DropdownItem');
    item = await findAsync(items, async i => (await i.getText()) === text);
    return !!item;
  });
  await item.waitForDisplayed();
  await item.click();
};
