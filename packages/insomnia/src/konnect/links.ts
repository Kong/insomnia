import { getKongDocsOrigin, getKonnectCloudOrigin } from '../common/constants';

export const getPluginHubUrl = () => `${getKongDocsOrigin()}/plugins/`;
export const getPluginPriorityDocsUrl = () => `${getKongDocsOrigin()}/gateway/entities/plugin/#plugin-priority`;
export const getDeckApplyDocsUrl = () => `${getKongDocsOrigin()}/deck/gateway/apply/`;

const encodePathSegment = (value: string) => encodeURIComponent(value);

/**
 * Konnect Gateway Manager deep links are not a documented URL contract. These
 * paths mirror the URLs the Konnect UI itself uses and must be re-checked when
 * the Konnect UI changes. Keep every Konnect URL construction here so there is
 * one place to update.
 */
export function getKonnectPluginsUrl(
  region: string | null | undefined,
  controlPlaneId: string | null | undefined,
): string | null {
  if (!region || !controlPlaneId) {
    return null;
  }
  return `${getKonnectCloudOrigin()}/${encodePathSegment(region)}/gateway-manager/${encodePathSegment(controlPlaneId)}/plugins`;
}

export function getKonnectPluginCreateUrl(
  region: string | null | undefined,
  controlPlaneId: string | null | undefined,
  pluginName: string,
): string | null {
  const pluginsUrl = getKonnectPluginsUrl(region, controlPlaneId);
  if (!pluginsUrl || !pluginName) {
    return null;
  }
  return `${pluginsUrl}/${encodePathSegment(pluginName)}/create`;
}

export function getKonnectPluginEditUrl(
  region: string | null | undefined,
  controlPlaneId: string | null | undefined,
  pluginName: string,
  pluginId: string,
): string | null {
  const pluginsUrl = getKonnectPluginsUrl(region, controlPlaneId);
  if (!pluginsUrl || !pluginName || !pluginId) {
    return null;
  }
  return `${pluginsUrl}/${encodePathSegment(pluginName)}/${encodePathSegment(pluginId)}/update`;
}

export function getPluginDocsUrl(pluginName: string): string {
  if (!pluginName) {
    return getPluginHubUrl();
  }
  return `${getPluginHubUrl()}${encodePathSegment(pluginName)}/`;
}
