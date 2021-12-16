const analyticsMessageShown = async app => {
  await app.client.waitUntilTextExists(
    'p strong',
    'Share Usage Analytics with Kong Inc',
  );
};

const clickDontShare = async app => {
  await app.client
    .$('button=Don\'t share usage analytics')
    .then(e => e.click());
};

export const skipOnboardingFlow = async app => {
  await analyticsMessageShown(app);
  await clickDontShare(app);
};
