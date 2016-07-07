
export const PREVIEW_MODE_FRIENDLY = 'friendly';
export const PREVIEW_MODE_SOURCE = 'source';
export const PREVIEW_MODE_RAW = 'raw';

const previewModeMap = {
  [PREVIEW_MODE_FRIENDLY]: 'Visual',
  [PREVIEW_MODE_SOURCE]: 'Source',
  [PREVIEW_MODE_RAW]: 'Raw'
};

export const PREVIEW_MODES = Object.keys(previewModeMap);

/**
 * Get the friendly name for a given preview mode
 *
 * @param previewMode
 * @returns {*|string}
 */
export function getPreviewModeName (previewMode) {
  // TODO: Make this more robust maybe...
  return previewModeMap[previewMode] || 'Unknown';
}
