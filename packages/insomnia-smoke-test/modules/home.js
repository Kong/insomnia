const documentListingShown = async app => {
  const item = await app.client.$('.document-listing');
  await item.waitForExist();
};

module.exports = {
  documentListingShown,
};
