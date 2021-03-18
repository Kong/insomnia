export const correctlyLaunched = async app => {
  await expect(app.browserWindow.isDevToolsOpened()).resolves.toBe(false);
  await expect(app.client.getWindowCount()).resolves.toBe(1);
  await expect(app.browserWindow.isMinimized()).resolves.toBe(false);
  await expect(app.browserWindow.isFocused()).resolves.toBe(true);
};

export const focusAfterRestart = async app => {
  await app.client.pause(4000);

  const count = await app.client.getWindowCount();
  if (count === 0) {
    console.log('No windows found');
  }

  await app.client.windowByIndex(0);
};
