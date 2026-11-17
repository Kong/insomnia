import type { FeatureList } from 'insomnia-api';
import type { Settings } from 'insomnia-data';

// Process-local copy of the current organization's features. Each process has its own instance:
// - renderer: written directly by the organization layout (routes/organization.tsx)
// - main: written via the `organizationFeatures.sync` IPC sent by that same layout
//   (see main/ipc/organization-features.ts)
// - plugin window: forwarded by main via `organizationFeatures.sync` whenever the features change
//   and whenever the plugin window becomes ready (see main/plugin-window.ts)
// Empty until the features load (or for local orgs), in which case only the user setting applies.
let currentFeatures: FeatureList | undefined;

export function setCurrentOrganizationFeatures(features?: FeatureList) {
  currentFeatures = features;
}

export function getCurrentOrganizationFeatures() {
  return currentFeatures;
}

export function isHideSecretValuesEnforcedByOrganization() {
  return currentFeatures?.hideSecretValuesInPreviewAndConsole?.enabled === true;
}

// Effective hideSecretValuesInPreviewAndConsole: the user setting, forced on when the organization enforces it.
export function resolveHideSecretValues(settings: Pick<Settings, 'hideSecretValuesInPreviewAndConsole'>) {
  return (settings.hideSecretValuesInPreviewAndConsole ?? true) || isHideSecretValuesEnforcedByOrganization();
}
