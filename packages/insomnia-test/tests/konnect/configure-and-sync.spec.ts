import { faker } from '@faker-js/faker';

import {
  DEFAULT_TIMEOUT,
  expect,
  setKonnectEntitlement,
  test,
} from '../../misc/fixtures';

test.beforeAll(async () => {
  await setKonnectEntitlement(true);
});

test.afterAll(async () => {
  await setKonnectEntitlement(false);
});

test(
  'Verify configuring a Konnect PAT closes the settings modal, shows the Sync Konnect button, and leaves the Projects tab usable',
  async ({ user }) => {
    const { konnectPage, workspacePage } = user.pageManager;

    await workspacePage.switchOrganization('Control Planes');
    await konnectPage.openTab();
    const introVisibleBeforeConfigure = await konnectPage.isIntroCardVisible();
    await konnectPage.clickConfigure();
    await konnectPage.setPat(`kpat_${faker.string.alphanumeric(20)}`);
    await konnectPage.clickConnectAndSync();
    const settingsModalOpenAfterConnect = await konnectPage.isSettingsModalOpen();
    await expect
      .poll(() => konnectPage.isSyncButtonVisible(), {
        timeout: DEFAULT_TIMEOUT,
      })
      .toBe(true);

    await konnectPage.openProjectsTab();

    expect(introVisibleBeforeConfigure).toBe(true);
    expect(settingsModalOpenAfterConnect).toBe(false);
  },
);

test(
  'Verify the initial Konnect sync creates the control plane project and a collection for each gateway service',
  async ({ user }) => {
    const { konnectPage, workspacePage } = user.pageManager;

    await workspacePage.switchOrganization('Control Planes');
    await konnectPage.openTab();
    await konnectPage.clickConfigure();
    await konnectPage.setPat(`kpat_${faker.string.alphanumeric(20)}`);
    await konnectPage.clickConnectAndSync();
    await konnectPage.openProjectsTab();

    await expect
      .poll(() => konnectPage.isControlPlaneVisible('E2E Control Plane'), {
        timeout: DEFAULT_TIMEOUT,
      })
      .toBe(true);
    await expect
      .poll(() => konnectPage.isServiceVisible('E2E HTTP Service'), {
        timeout: DEFAULT_TIMEOUT,
      })
      .toBe(true);
    await expect
      .poll(() => konnectPage.isServiceVisible('E2E Realtime Service'), {
        timeout: DEFAULT_TIMEOUT,
      })
      .toBe(true);
  },
);

test(
  'Verify syncing Konnect again after the first sync completes without errors',
  async ({ user }) => {
    const { konnectPage, workspacePage } = user.pageManager;

    await workspacePage.switchOrganization('Control Planes');
    await konnectPage.openTab();
    await konnectPage.clickConfigure();
    await konnectPage.setPat(`kpat_${faker.string.alphanumeric(20)}`);
    await konnectPage.clickConnectAndSync();
    await konnectPage.openProjectsTab();
    await expect
      .poll(() => konnectPage.isControlPlaneVisible('E2E Control Plane'), {
        timeout: DEFAULT_TIMEOUT,
      })
      .toBe(true);

    await konnectPage.clickSync();

    await expect
      .poll(() => konnectPage.isSyncButtonVisible(), {
        timeout: DEFAULT_TIMEOUT,
      })
      .toBe(true);
    expect(await konnectPage.isControlPlaneVisible('E2E Control Plane')).toBe(true);
  },
);
