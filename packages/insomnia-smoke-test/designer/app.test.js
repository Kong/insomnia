import * as onboarding from '../modules/onboarding';
import * as client from '../modules/client';
import * as home from '../modules/home';

import { launchDesigner, stop } from '../modules/application';

describe('Application launch', function() {
  jest.setTimeout(50000);
  let app = null;

  beforeEach(async () => {
    app = await launchDesigner();
  });

  afterEach(async () => {
    await stop(app);
  });

  it('can reset to and proceed through onboarding flow', async () => {
    await client.correctlyLaunched(app);
    await client.resetToOnboarding(app);

    await onboarding.welcomeMessageShown(app);
    await onboarding.clickDontShare(app);
    await onboarding.clickSkipImport(app);

    await home.documentListingShown(app);
  });
});
