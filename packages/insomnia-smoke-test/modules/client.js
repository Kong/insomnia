export const correctlyLaunched = async app => {
  await expect(app.browserWindow.isDevToolsOpened()).resolves.toBe(false);
  await expect(app.client.getWindowCount()).resolves.toBe(1);
  await expect(app.browserWindow.isMinimized()).resolves.toBe(false);
  await expect(app.browserWindow.isFocused()).resolves.toBe(true);
};
