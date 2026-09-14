type KonnectSyncTrigger = (konnectOrganizationId?: string | null) => Promise<void>;

let trigger: KonnectSyncTrigger | null = null;

/**
 * Lets the Konnect settings modal start a sync without being handed a callback by whichever
 * component happens to render it. No-ops when nothing is registered.
 */
export const registerKonnectSyncTrigger = (fn: KonnectSyncTrigger | null) => {
  trigger = fn;
};

export const runKonnectSync = async (konnectOrganizationId?: string | null) => {
  await trigger?.(konnectOrganizationId);
};
