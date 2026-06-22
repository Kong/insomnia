import type { ElectronApplication, PlaywrightWorkerArgs } from '@playwright/test';

import { bundleType, cwd, executablePath, mainPath } from './paths';

export interface EnvOptions {
  INSOMNIA_DATA_PATH: string;
  INSOMNIA_API_URL: string;
  INSOMNIA_APP_WEBSITE_URL: string;
  INSOMNIA_AI_URL: string;
  INSOMNIA_MOCK_API_URL: string;
  INSOMNIA_GITHUB_REST_API_URL: string;
  INSOMNIA_GITHUB_API_URL: string;
  INSOMNIA_GITLAB_API_URL: string;
  INSOMNIA_UPDATES_URL: string;
  INSOMNIA_SKIP_ONBOARDING: string;
  INSOMNIA_PUBLIC_KEY: string;
  INSOMNIA_SECRET_KEY: string;
  INSOMNIA_SESSION?: string;
  INSOMNIA_VAULT_KEY: string;
  INSOMNIA_VAULT_SALT: string;
  INSOMNIA_VAULT_SRP_SECRET: string;
  KONNECT_API_URL: string;
  KONNECT_API_REGIONS?: string;
}

/**
 * Tracks every ElectronApplication launched during a test so the `app` fixture
 * teardown can close any that survive (e.g. instances created by relaunch()).
 */
export const liveApps = new Set<ElectronApplication>();

/**
 * Launches Insomnia with the given env options. Extracted from the `app` fixture
 * so tests can perform a real process-level relaunch (see InsomniaApp.relaunch).
 */
export async function launchInsomnia(
  playwright: PlaywrightWorkerArgs['playwright'],
  envOptions: EnvOptions,
): Promise<ElectronApplication> {
  const { ELECTRON_RUN_AS_NODE: _ignored, ...launchEnv } = process.env;
  const app = await playwright._electron.launch({
    cwd,
    executablePath,
    args: bundleType() === 'package' ? ['--no-sandbox'] : ['--no-sandbox', mainPath],
    env: {
      ...launchEnv,
      ...envOptions,
      PLAYWRIGHT: 'true',
    },
  });
  liveApps.add(app);
  app.on('close', () => liveApps.delete(app));
  return app;
}
