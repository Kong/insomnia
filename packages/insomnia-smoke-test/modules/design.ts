import { Application } from 'spectron';

export const pageDisplayed = async (app: Application) => {
  await app.client.react$('WrapperDesign').then(e => e.waitForDisplayed());
};

export const goToActivity = async (app: Application, activity: 'spec' | 'debug' | 'test' = 'spec') => {
  // NOTE: We shouldn't need to click the span.
  // TODO: Make the radio button group in the header keyboard accessible.
  const debugRadioInput = await app.client.$(`input[name="activity-toggle"][value=${activity}] ~ span`);

  await debugRadioInput.click();
};
