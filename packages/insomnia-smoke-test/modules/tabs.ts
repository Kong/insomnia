export const clickTabByText = async (element, text) => {
  await element.$(`.react-tabs__tab=${text}`).then(e => e.click());
};
