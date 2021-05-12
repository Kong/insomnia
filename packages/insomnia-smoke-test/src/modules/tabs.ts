// @ts-expect-error -- TSCONVERSION as far as I know we dont this type handy
export const clickTabByText = async (element, text: string) => {
  // @ts-expect-error -- TSCONVERSION
  await element.$(`.react-tabs__tab=${text}`).then(e => e.click());
};
