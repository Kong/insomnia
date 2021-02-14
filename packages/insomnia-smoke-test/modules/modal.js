import findAsync from './find-async';

export const waitUntilOpened = async (app, { modalName, title }) => {
  if (modalName) {
    const modal = await app.client.react$(modalName);
    await modal.waitForDisplayed();
  } else {
    await app.client.waitUntilTextExists('div.modal__header__children', title);
  }
};

export const close = async (app, modalName) => {
  let modal;
  if (modalName) {
    modal = await app.client.react$(modalName);
  } else {
    const modals = await app.client.react$$('Modal');
    modal = await findAsync(modals, m => m.isDisplayed());
  }

  await modal.$('button.modal__close-btn').then(e => e.click());
};

export const clickModalFooterByText = async (app, modalName, text) => {
  const modal = await app.client.react$(modalName);
  await modal.waitForDisplayed();
  const btn = await modal.$(`.modal__footer`).then(e => e.$(`button*=${text}`));
  await btn.waitForClickable();
  await btn.click();
};
