import { Application } from 'spectron';

import findAsync from './find-async';

interface WaitUntilOpenedOptions {modalName?: string; title?: string}
export const waitUntilOpened = async (app, { modalName, title }: WaitUntilOpenedOptions) => {
  if (modalName) {
    const modal = await app.client.react$(modalName);
    await modal.waitForDisplayed();
  } else {
    await app.client.waitUntilTextExists('div.modal__header__children', title);
  }
};

export const close = async (app: Application, modalName?: string) => {
  let modal;
  if (modalName) {
    modal = await app.client.react$(modalName);
  } else {
    const modals = await app.client.react$$('Modal');
    modal = await findAsync(modals, m => m.isDisplayed());
  }

  await modal.$('button.modal__close-btn').then(e => e.click());
};

export const clickModalFooterByText = async (app, text) => {
  const btn = await app.client
    .$('.modal[aria-hidden=false] .modal__footer')
    .then(e => e.$(`button*=${text}`));
  await btn.waitForClickable();
  await btn.click();
};

export const typeIntoModalInput = async (app, text) => {
  const input = await app.client.$('.modal input');
  await input.waitUntil(() => input.isFocused());
  await input.keys(text);
};
