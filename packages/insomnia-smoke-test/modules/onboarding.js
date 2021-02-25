export const analyticsMessageShown = async app => {
  await app.client.waitUntilTextExists(
    '.onboarding__content__body p strong',
    'Share Usage Analytics with Kong Inc',
  );
};

export const clickDontShare = async app => {
  await app.client
    .$('.onboarding__content__body')
    .then(e => e.$(`button=Don't share usage analytics`))
    .then(e => e.click());
};

export const clickSkipImport = async app => {
  await app.client
    .$('.onboarding__content__body')
    .then(e => e.$(`button=Skip`))
    .then(e => e.click());
};
