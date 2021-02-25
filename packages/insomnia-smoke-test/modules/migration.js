export const migrationMessageShown = async app => {
  console.log('waiting for migration message');
  await app.client.waitUntilTextExists(
    '.onboarding__content__body p strong',
    'Migrate from Insomnia Designer',
  );
};

export const clickSkip = async app => {
  const button = await app.client
    .$('.onboarding__content__body')
    .then(e => e.$(`button=Skip for now`));
  await button.waitForClickable();
  await button.click();
};

export const clickStart = async app => {
  const button = await app.client
    .$('.onboarding__content__body')
    .then(e => e.$(`button=Start Migration`));
  await button.waitForClickable();
  await button.click();
};

export const successMessageShown = async app => {
  console.log('waiting for success message');
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
