'use strict';

module.exports.PREVIEW_MODE_FRIENDLY = 'friendly';
module.exports.PREVIEW_MODE_SOURCE = 'source';
module.exports.PREVIEW_MODE_RAW = 'raw';

const previewModeMap = {
  [module.exports.PREVIEW_MODE_FRIENDLY]: 'Visual',
  [module.exports.PREVIEW_MODE_SOURCE]: 'Source',
  [module.exports.PREVIEW_MODE_RAW]: 'Raw'
};

module.exports.PREVIEW_MODES = Object.keys(previewModeMap);

/**
 * Get the friendly name for a given preview mode
 *
 * @param previewMode
 * @returns {*|string}
 */
module.exports.getPreviewModeName = previewMode => {
  // TODO: Make this more robust maybe...
  return previewModeMap[previewMode] || 'Unknown';
};
