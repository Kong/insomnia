import { type APIRequestContext, expect, type Page } from '@playwright/test';

import { test } from '../../playwright/test';

test.describe('Konnect plugin info', () => {
  const controlPlane = {
    id: 'cp-e2e',
    name: 'E2E Control Plane',
    description: 'Control plane used by the plugin tab smoke test',
    region: 'us',
    config: {
      cluster_type: 'CLUSTER_TYPE_CONTROL_PLANE',
      control_plane_endpoint: 'https://cp-e2e.example.com',
      cloud_gateway: false,
    },
    proxy_urls: null,
  };

  const service = {
    id: 'svc-e2e',
    name: 'flights-svc',
    protocol: 'http',
    host: 'flights.example.com',
    port: 80,
    path: null,
    enabled: true,
    tags: null,
  };

  const route = {
    id: 'route-e2e',
    name: 'flights-collection',
    methods: ['GET'],
    paths: ['/flights'],
    protocols: ['http'],
    hosts: null,
    headers: null,
    snis: null,
    expression: null,
    service: { id: 'svc-e2e' },
  };

  const wsRoute = {
    id: 'route-ws-e2e',
    name: 'echo-ws',
    methods: null,
    paths: ['/ws'],
    protocols: ['ws'],
    hosts: null,
    headers: null,
    snis: null,
    expression: null,
    service: { id: 'svc-e2e' },
  };

  const grpcRoute = {
    id: 'route-grpc-e2e',
    name: 'hello-grpc',
    methods: null,
    paths: ['/hello.HelloService/SayHello'],
    protocols: ['grpc'],
    hosts: null,
    headers: null,
    snis: null,
    expression: null,
    service: { id: 'svc-e2e' },
  };

  const plugin = (overrides: Record<string, unknown>) => ({
    instance_name: null,
    enabled: true,
    config: {},
    protocols: null,
    tags: null,
    condition: null,
    ordering: null,
    route: null,
    service: null,
    consumer: null,
    consumer_group: null,
    ...overrides,
  });

  const plugins = [
    plugin({ id: 'plugin-route-auth', name: 'key-auth', route: { id: 'route-e2e' } }),
    plugin({
      id: 'plugin-service-rate-limit',
      name: 'rate-limiting',
      service: { id: 'svc-e2e' },
      config: { minute: 5 },
    }),
    plugin({
      id: 'plugin-global-cors',
      name: 'cors',
      ordering: { before: { access: ['key-auth'] } },
    }),
    plugin({
      id: 'plugin-route-conditional',
      name: 'request-termination',
      route: { id: 'route-e2e' },
      condition: 'http.path == "/flights"',
      consumer: { id: 'consumer-e2e' },
    }),
    plugin({ id: 'plugin-ws-auth', name: 'key-auth', route: { id: 'route-ws-e2e' }, protocols: ['ws'] }),
    plugin({ id: 'plugin-grpc-auth', name: 'key-auth', route: { id: 'route-grpc-e2e' }, protocols: ['grpc'] }),
    plugin({ id: 'plugin-other-route', name: 'basic-auth', route: { id: 'route-other' } }),
    plugin({
      id: 'plugin-other-route-transformer',
      name: 'request-transformer',
      route: { id: 'route-other' },
    }),
    plugin({ id: 'plugin-global-auth', name: 'key-auth' }),
  ];

  const fixtures = {
    controlPlanes: [controlPlane],
    services: [service],
    routes: [route, grpcRoute, wsRoute],
    plugins,
  };

  async function setKonnectFixtures(
    request: APIRequestContext,
    overrides: Partial<typeof fixtures> & { failPlugins?: boolean; failAvailability?: boolean } = {},
  ) {
    await request.post('http://127.0.0.1:4010/v1/test-utils/konnect/fixtures', {
      data: { ...fixtures, ...overrides },
    });
  }

  async function dismissKonnectOnboarding(page: Page) {
    await page.getByRole('button', { name: 'Got It' }).click({ timeout: 3000 }).catch(() => {});
  }

  async function openPluginsTab(page: Page, expectLoaded = true) {
    await page.getByRole('button', { name: 'Organizations' }).click();
    await page.getByRole('option', { name: 'Control Planes' }).click();
    await page.getByRole('button', { name: 'Configure' }).click();
    await page.getByLabel('Personal Access Token').fill('kpat_test');
    await page.getByRole('button', { name: 'Connect & Sync' }).click();

    await expect.soft(page.getByTestId('project-node-E2E Control Plane')).toBeVisible({ timeout: 30_000 });
    await dismissKonnectOnboarding(page);
    await page.getByTestId('project-node-E2E Control Plane').click();
    await page.getByTestId('workspace-node-flights-svc').click();
    await page
      .getByLabel('Expand flights-svc')
      .click({ timeout: 1000 })
      .catch(() => {});
    await page
      .getByLabel('Expand flights-collection')
      .click({ timeout: 1000 })
      .catch(() => {});

    const requestRow = page.getByTestId('request-node-/flights').first();
    await expect.soft(requestRow).toBeVisible();
    await requestRow.click();
    await dismissKonnectOnboarding(page);
    const tabs = page.getByRole('tablist', { name: 'Request pane tabs' });
    await tabs.getByRole('tab', { name: 'Plugins' }).click();
    if (!expectLoaded) {
      return;
    }
    await expect.soft(page.getByText('Konnect plugins')).toBeVisible();
    await tabs.getByRole('tab', { name: 'Docs' }).click();
    await tabs.getByRole('tab', { name: 'Plugins' }).click();
    await expect.soft(page.getByText('Konnect plugins')).toBeVisible();
  }

  test.beforeEach(async ({ request }) => {
    await setKonnectFixtures(request);
  });

  test.afterEach(async ({ request }) => {
    await setKonnectFixtures(request, { controlPlanes: [], services: [], routes: [], plugins: [] });
  });

  test('shows the plugins that apply to a synced request', async ({ page }) => {
    test.setTimeout(90_000);
    const pluginRequests: string[] = [];
    const availablePluginRequests: string[] = [];
    page.on('request', request => {
      if (request.method() === 'GET' && request.url().includes('/core-entities/plugins')) {
        pluginRequests.push(request.url());
      }
      if (request.method() === 'GET' && request.url().includes('/core-entities/v1/available-plugins')) {
        availablePluginRequests.push(request.url());
      }
    });
    await page.getByRole('button', { name: 'Organizations' }).click();
    await page.getByRole('option', { name: 'Control Planes' }).click();

    await page.getByRole('button', { name: 'Configure' }).click();
    await page.getByLabel('Personal Access Token').fill('kpat_test');
    await page.getByRole('button', { name: 'Connect & Sync' }).click();

    await expect.soft(page.getByTestId('project-node-E2E Control Plane')).toBeVisible({ timeout: 30_000 });
    await dismissKonnectOnboarding(page);
    await page.getByTestId('project-node-E2E Control Plane').click();
    await page.getByTestId('workspace-node-flights-svc').click();

    await page
      .getByLabel('Expand flights-svc')
      .click({ timeout: 1000 })
      .catch(() => {});
    await page
      .getByLabel('Expand flights-collection')
      .click({ timeout: 1000 })
      .catch(() => {});

    const requestRow = page.getByTestId('request-node-/flights').first();
    await expect.soft(requestRow).toBeVisible();
    await requestRow.click();

    const pluginsTab = page.getByRole('tablist', { name: 'Request pane tabs' }).getByRole('tab', { name: 'Plugins' });
    await dismissKonnectOnboarding(page);
    await pluginsTab.click();

    await expect.soft(page.getByText('Konnect plugins')).toBeVisible();
    await expect.soft(page.getByText('key-auth', { exact: true })).toHaveCount(2);
    await expect.soft(page.getByText('rate-limiting', { exact: true })).toBeVisible();
    await expect.soft(page.getByText('cors', { exact: true })).toBeVisible();
    await expect.soft(page.getByText('request-termination', { exact: true })).toBeVisible();
    await expect.soft(page.getByText('Condition', { exact: true })).toBeVisible();
    await expect.soft(page.getByText('Consumer', { exact: true })).toBeVisible();
    await expect.soft(page.getByText('5 enabled plugin instances, 1 conditional.')).toBeVisible();
    await expect.soft(page.getByText('basic-auth')).toBeHidden();
    await expect.soft(page.getByText('Suggested plugins')).toBeVisible();
    await expect.soft(page.getByText('Datakit', { exact: true })).toBeVisible();
    await expect.soft(page.getByText('Request Transformer', { exact: true })).toBeVisible();

    await page.getByRole('tablist', { name: 'Request pane tabs' }).getByRole('tab', { name: 'Docs' }).click();
    await pluginsTab.click();
    await expect.soft(page.getByText('Konnect plugins')).toBeVisible();
    expect.soft(pluginRequests).toHaveLength(1);
    expect.soft(availablePluginRequests).toHaveLength(1);

    await page.getByRole('button', { name: 'Refresh' }).click();
    await expect.poll(() => pluginRequests.length).toBe(2);
    await expect.poll(() => availablePluginRequests.length).toBe(2);
  });

  test('shows the Plugins tab for a synced gRPC request', async ({ page }) => {
    test.setTimeout(90_000);
    await page.getByRole('button', { name: 'Organizations' }).click();
    await page.getByRole('option', { name: 'Control Planes' }).click();
    await page.getByRole('button', { name: 'Configure' }).click();
    await page.getByLabel('Personal Access Token').fill('kpat_test');
    await page.getByRole('button', { name: 'Connect & Sync' }).click();

    await expect.soft(page.getByTestId('project-node-E2E Control Plane')).toBeVisible({ timeout: 30_000 });
    await dismissKonnectOnboarding(page);
    await page.getByTestId('project-node-E2E Control Plane').click();
    await page.getByTestId('workspace-node-flights-svc').click();
    await page
      .getByLabel('Expand flights-svc')
      .click({ timeout: 1000 })
      .catch(() => {});
    await page
      .getByLabel('Expand hello-grpc')
      .click({ timeout: 1000 })
      .catch(() => {});

    const requestRow = page.getByTestId('request-node-/hello.HelloService/SayHello').first();
    await expect.soft(requestRow).toBeVisible();
    await requestRow.click();

    const pluginsTab = page.getByRole('tablist', { name: 'Request pane tabs' }).getByRole('tab', { name: 'Plugins' });
    await dismissKonnectOnboarding(page);
    await pluginsTab.click();

    await expect.soft(page.getByText('Konnect plugins')).toBeVisible();
    await expect.soft(page.getByText('key-auth', { exact: true })).toHaveCount(2);
    await expect.soft(page.getByText('Route', { exact: true })).toBeVisible();
  });

  test('shows the Plugins tab for a synced WebSocket request', async ({ page }) => {
    test.setTimeout(90_000);
    await page.getByRole('button', { name: 'Organizations' }).click();
    await page.getByRole('option', { name: 'Control Planes' }).click();
    await page.getByRole('button', { name: 'Configure' }).click();
    await page.getByLabel('Personal Access Token').fill('kpat_test');
    await page.getByRole('button', { name: 'Connect & Sync' }).click();

    await expect.soft(page.getByTestId('project-node-E2E Control Plane')).toBeVisible({ timeout: 30_000 });
    await dismissKonnectOnboarding(page);
    await page.getByTestId('project-node-E2E Control Plane').click();
    await page.getByTestId('workspace-node-flights-svc').click();
    await page
      .getByLabel('Expand flights-svc')
      .click({ timeout: 1000 })
      .catch(() => {});
    await page
      .getByLabel('Expand echo-ws')
      .click({ timeout: 1000 })
      .catch(() => {});

    const requestRow = page.getByTestId('request-node-/ws').first();
    await expect.soft(requestRow).toBeVisible();
    await requestRow.click();

    const pluginsTab = page.getByRole('tablist', { name: 'Request pane tabs' }).getByRole('tab', { name: 'Plugins' });
    await dismissKonnectOnboarding(page);
    await pluginsTab.click();

    await expect.soft(page.getByText('Konnect plugins')).toBeVisible();
    await expect.soft(page.getByText('key-auth', { exact: true })).toHaveCount(2);
    await expect.soft(page.getByText('Route', { exact: true })).toBeVisible();
  });

  test('keeps cached plugins when a refresh fails', async ({ page, request }) => {
    test.setTimeout(90_000);
    await openPluginsTab(page);
    await expect.soft(page.getByText('key-auth', { exact: true })).toHaveCount(2);

    await setKonnectFixtures(request, { failPlugins: true });
    await page.getByRole('button', { name: 'Refresh' }).click();

    await expect.soft(page.getByText('Failed to refresh plugins.')).toBeVisible();
    await expect.soft(page.getByText('key-auth', { exact: true })).toHaveCount(2);

    const alert = page.getByRole('alert');
    const alertBox = await alert.boundingBox();
    const retryBox = await alert.getByRole('button', { name: 'Retry' }).boundingBox();
    expect.soft(alertBox).not.toBeNull();
    expect.soft(retryBox).not.toBeNull();
    const alertCenter = (alertBox?.y ?? 0) + (alertBox?.height ?? 0) / 2;
    const retryCenter = (retryBox?.y ?? 0) + (retryBox?.height ?? 0) / 2;
    expect.soft(Math.abs(alertCenter - retryCenter)).toBeLessThan(3);
    expect
      .soft(await alert.evaluate(element => Number.parseFloat(getComputedStyle(element).marginBottom)))
      .toBeGreaterThanOrEqual(8);
  });

  test('shows a retry state when plugins fail to load', async ({ page, request }) => {
    test.setTimeout(90_000);
    await setKonnectFixtures(request, { failPlugins: true });
    await openPluginsTab(page, false);

    await expect.soft(page.getByText('Failed to load plugins')).toBeVisible();
    await expect.soft(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  });

  test('hides suggestions when the availability check fails', async ({ page, request }) => {
    test.setTimeout(90_000);
    const warnings: string[] = [];
    page.on('console', message => {
      if (message.type() === 'warning') {
        warnings.push(message.text());
      }
    });
    await openPluginsTab(page);
    await expect.soft(page.getByText('Suggested plugins')).toBeVisible();

    await setKonnectFixtures(request, { failAvailability: true });
    await page.getByRole('button', { name: 'Refresh' }).click();

    await expect.soft(page.getByText('Suggested plugins')).toBeHidden();
    await expect.soft(page.getByText('key-auth', { exact: true })).toHaveCount(2);
    await expect
      .poll(() => warnings.some(message => message.includes('[konnect] Failed to check available plugins')))
      .toBe(true);
  });

  test('shows an empty notice when no plugins apply', async ({ page, request }) => {
    test.setTimeout(90_000);
    await setKonnectFixtures(request, { plugins: [] });
    await openPluginsTab(page);

    await expect.soft(page.getByText('No plugins apply to this request.')).toBeVisible();
  });

  test('hides the Plugins tab for a non-Konnect project', async ({ page, insomnia }) => {
    test.setTimeout(60_000);
    await insomnia.projectPage.createProject('Non-Konnect Project');
    await insomnia.projectPage.importFixture('simple.yaml');

    await page.getByTestId('request-node-example http').click();

    await expect
      .soft(page.getByRole('tablist', { name: 'Request pane tabs' }).getByRole('tab', { name: 'Plugins' }))
      .toBeHidden();
  });
});

test.describe('Control Planes organization', () => {
  test('shows intro card without a PAT, configure it, then sync', async ({ page }) => {
    await page.getByRole('button', { name: 'Organizations' }).click();
    await page.getByRole('option', { name: 'Control Planes' }).click();
    await expect.soft(page.getByText('Auto-sync your gateway service routes')).toBeVisible();

    await page.getByRole('button', { name: 'Configure' }).click();
    await page.getByLabel('Personal Access Token').fill('kpat_test');
    await page.getByRole('button', { name: 'Connect & Sync' }).click();
    await expect.soft(page.getByRole('heading', { name: 'Kong Konnect settings' })).toBeHidden();

    // The Sync button and settings gear are both available even with zero projects synced yet.
    await expect.soft(page.getByRole('button', { name: 'Sync Konnect' })).toBeVisible();
    await expect.soft(page.getByRole('button', { name: 'Konnect settings' })).toBeVisible();
    // The Konnect organization never offers manual project creation.
    await expect.soft(page.getByRole('button', { name: 'Create new Project' })).toBeHidden();
  });

  test.describe('without the Konnect control planes entitlement', () => {
    test.beforeEach(async ({ request }) => {
      await request.post('http://127.0.0.1:4010/v1/test-utils/user/entitlements', {
        data: { entitlements: [] },
      });
    });

    test.afterEach(async ({ request }) => {
      await request.post('http://127.0.0.1:4010/v1/test-utils/user/entitlements', { data: {} });
    });

    test('hides the Control Planes organization', async ({ page }) => {
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Organizations' }).click();
      await expect.soft(page.getByRole('option', { name: 'Control Planes' })).toBeHidden();
    });
  });
});
