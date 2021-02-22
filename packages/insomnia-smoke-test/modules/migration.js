export const migrationMessageShown = async app => {
  await app.client.waitUntilTextExists(
    '.onboarding__content__body p strong',
    'Migrate from Insomnia Designer',
  );
};

export const clickSkip = async app => {
  await app.client
    .$('.onboarding__content__body')
    .then(e => e.$(`button=Skip for now`))
    .then(e => e.click());
};

export const clickStart = async app => {
  await app.client
    .$('.onboarding__content__body')
    .then(e => e.$(`button=Start Migration`))
    .then(e => e.click());
};

export const successMessageShown = async app => {
  await app.client.waitUntilTextExists(
    '.onboarding__content__body p strong',
    'Migrated successfully!',
    10000, // Wait 10 seconds for migration to complete
  );
};

export const clickRestart = async app => {
  await app.client
    .$('.onboarding__content__body')
    .then(e => e.$(`button=Restart Now`))
    .then(e => e.click());
};
