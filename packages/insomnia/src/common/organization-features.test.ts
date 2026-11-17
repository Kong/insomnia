import type { FeatureList } from 'insomnia-api';
import { afterEach, describe, expect, it } from 'vitest';

import {
  getCurrentOrganizationFeatures,
  isHideSecretValuesEnforcedByOrganization,
  resolveHideSecretValues,
  setCurrentOrganizationFeatures,
} from './organization-features';

const featuresWithHideSecretValues = (enabled: boolean) =>
  ({ hideSecretValuesInPreviewAndConsole: { enabled } }) as FeatureList;

describe('organization-features', () => {
  afterEach(() => {
    setCurrentOrganizationFeatures();
  });

  it('is not enforced when no features have been synced', () => {
    expect(getCurrentOrganizationFeatures()).toBeUndefined();
    expect(isHideSecretValuesEnforcedByOrganization()).toBe(false);
  });

  it('returns the cached features', () => {
    const features = featuresWithHideSecretValues(true);
    setCurrentOrganizationFeatures(features);
    expect(getCurrentOrganizationFeatures()).toBe(features);
  });

  it('is enforced only when the synced feature is enabled', () => {
    setCurrentOrganizationFeatures(featuresWithHideSecretValues(false));
    expect(isHideSecretValuesEnforcedByOrganization()).toBe(false);

    setCurrentOrganizationFeatures(featuresWithHideSecretValues(true));
    expect(isHideSecretValuesEnforcedByOrganization()).toBe(true);
  });

  it.each([
    { setting: true, enforced: false, expected: true },
    { setting: false, enforced: false, expected: false },
    { setting: undefined, enforced: false, expected: true },
    { setting: false, enforced: true, expected: true },
    { setting: true, enforced: true, expected: true },
  ])(
    'resolveHideSecretValues(setting=$setting, enforced=$enforced) = $expected',
    ({ setting, enforced, expected }) => {
      setCurrentOrganizationFeatures(featuresWithHideSecretValues(enforced));
      expect(
        resolveHideSecretValues({ hideSecretValuesInPreviewAndConsole: setting as unknown as boolean }),
      ).toBe(expected);
    },
  );
});
