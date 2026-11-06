/**
 * Walks a freshly launched app to the provider-picker screen, whichever entry
 * point it happened to land on.
 *
 *   node .claude/skills/run-insomnia/drive.mjs exec .claude/skills/run-insomnia/scripts/goto-login.ts
 *
 * A first launch of a real profile lands on /onboarding; a second one lands in
 * the Scratch Pad. Both reach the login screen, just by different clicks.
 */
import type { Page } from '@playwright/test';

interface Ctx {
  page: Page;
  log: (...xs: unknown[]) => void;
}

export default async ({ page, log }: Ctx) => {
  for (let step = 0; step < 6; step++) {
    if (await page.getByRole('button', { name: 'Continue with Email' }).count()) {
      const providers = await page.getByRole('button', { name: /^Continue with / }).allInnerTexts();
      return { at: 'login', url: page.url(), providers: providers.map(p => p.trim()) };
    }

    const login = page.getByRole('link', { name: 'Login' });
    const onboardingNext = page.getByRole('link', { name: 'Continue' });

    if (await login.count()) {
      log('clicking Login at', page.url());
      await login.first().click();
    } else if (await onboardingNext.count()) {
      log('advancing onboarding at', page.url());
      await onboardingNext.first().click();
    } else {
      return { at: 'stuck', url: page.url(), hint: 'no Login link or onboarding Continue on screen' };
    }
    await page.waitForTimeout(2500);
  }
  return { at: 'gave-up', url: page.url() };
};
