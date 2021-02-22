export const documentListingShown = async app => {
  const item = await app.client.$('.document-listing');
  await item.waitForExist();
};

export const expectDocumentWithTitle = async (app, title) => {
  await app.client.waitUntilTextExists('.document-listing__body', title);
};

export const openDocumentMenuDropdown = async app => {
  const dropdown = await app.client.react$('DocumentCardDropdown');
  await dropdown.click();
  return dropdown;
};
