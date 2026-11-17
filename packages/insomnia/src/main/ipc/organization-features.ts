import type { FeatureList } from 'insomnia-api';

import { setCurrentOrganizationFeatures } from '~/common/organization-features';

import { syncOrganizationFeaturesToPluginWindow } from '../plugin-window';
import { ipcMainOn } from './electron';

export interface OrganizationFeaturesBridgeAPI {
  // Omit features to clear them (e.g. when leaving the organization).
  sync: (features?: FeatureList) => void;
}

export function registerOrganizationFeaturesHandlers() {
  ipcMainOn('organizationFeatures.sync', (_, features: FeatureList | undefined) => {
    setCurrentOrganizationFeatures(features);
    syncOrganizationFeaturesToPluginWindow(features);
  });
}
