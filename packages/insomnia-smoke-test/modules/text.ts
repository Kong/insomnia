import { Application } from 'spectron';

export const waitUntilTextDisappears = async (app: Application, element: WebdriverIO.Element, text: string) => {
  await app.client.waitUntil(async () =>
    !(await element.getText()).includes(text)
  );
};
