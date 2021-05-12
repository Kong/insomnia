import { Application } from 'spectron';

export const migrationMessageShown = async (app: Application) => {
  await app.client.waitUntilTextExists(
    '.onboarding__content__header h1',
    'Migrate from Insomnia Designer',
  );
};

export const clickSkip = async (app: Application) => {
  const button = await app.client.react$('MigrationBody').then(e => e.$('button=Skip for now'));
  await button.waitForClickable();
  await button.click();
};

export const toggleOption = async (app: Application, label: string) => {
  const toggle = await app.client
    .$('.onboarding__content__body')
    .then(e => e.react$('BooleanSetting', { props: { label } }));
  await toggle.waitForClickable();
  await toggle.click();
};

const _getStartButton = async (app: Application) => {
  return await app.client.react$('MigrationBody').then(e => e.$('button=Start Migration'));
};

export const clickStart = async (app: Application) => {
  const button = await _getStartButton(app);
  await button.waitForClickable();
  await button.click();
};

export const ensureStartNotClickable = async (app: Application) => {
  const button = await _getStartButton(app);
  await button.waitForClickable({ reverse: true });
};

export const successMessageShown = async (app: Application) => {
  await app.client.waitUntilTextExists(
    '.onboarding__content__body p strong',
    'Migrated successfully!',
    10000, // Wait 10 seconds for migration to complete
  );
};

export const clickRestart = async (app: Application) => {
  await app.client
    .react$('MigrationBody')
    .then(e => e.$('button=Restart Now'))
    .then(e => e.click());
};
