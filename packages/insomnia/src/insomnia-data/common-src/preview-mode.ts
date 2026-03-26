// Preview Modes
export const PREVIEW_MODE_FRIENDLY = 'friendly';
export const PREVIEW_MODE_SOURCE = 'source';
export const PREVIEW_MODE_RAW = 'raw';
const previewModeMap = {
  [PREVIEW_MODE_FRIENDLY]: ['Preview', 'Visual Preview'],
  [PREVIEW_MODE_SOURCE]: ['Source', 'Source Code'],
  [PREVIEW_MODE_RAW]: ['Raw', 'Raw Data'],
};
export const PREVIEW_MODES = Object.keys(previewModeMap) as (keyof typeof previewModeMap)[];

export type PreviewMode = 'friendly' | 'source' | 'raw';

export function getPreviewModeName(previewMode: PreviewMode, useLong = false) {
  if (previewMode in previewModeMap) {
    return useLong ? previewModeMap[previewMode][1] : previewModeMap[previewMode][0];
  }
  return '';
}
