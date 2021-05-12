import { Application } from 'spectron';

const analyticsMessageShown = async (app: Application) => {
  await app.client.waitUntilTextExists(
    '.onboarding__content__body p strong',
    'Share Usage Analytics with Kong Inc',
  );
};

const clickDontShare = async (app: Application) => {
  await app.client
    .$('.onboarding__content__body')
    .then(e => e.$('button=Don\'t share usage analytics'))
    .then(e => e.click());
};

const clickSkipImport = async (app: Application) => {
  await app.client
    .$('.onboarding__content__body')
    .then(e => e.$('button=Skip'))
    .then(e => e.click());
};

export const skipOnboardingFlow = async (app: Application) => {
  await analyticsMessageShown(app);
  await clickDontShare(app);
  await clickSkipImport(app);
};
