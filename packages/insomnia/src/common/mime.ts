const extensionToMimeType: Record<string, string> = {
  // text
  css: 'text/css',
  csv: 'text/csv',
  htm: 'text/html',
  html: 'text/html',
  js: 'application/javascript',
  json: 'application/json',
  jsonld: 'application/ld+json',
  md: 'text/markdown',
  mjs: 'application/javascript',
  txt: 'text/plain',
  xml: 'application/xml',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  // image
  bmp: 'image/bmp',
  gif: 'image/gif',
  ico: 'image/x-icon',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  webp: 'image/webp',
  // audio/video
  aac: 'audio/aac',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
  wav: 'audio/wav',
  webm: 'video/webm',
  // document / office
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // archive / binary
  gz: 'application/gzip',
  tar: 'application/x-tar',
  wasm: 'application/wasm',
  zip: 'application/zip',
  // font
  otf: 'font/otf',
  ttf: 'font/ttf',
  woff: 'font/woff',
  woff2: 'font/woff2',
};

const mimeTypeToExtension: Record<string, string> = {
  ...Object.fromEntries(Object.entries(extensionToMimeType).map(([extension, mimeType]) => [mimeType, extension])),
  'application/octet-stream': 'bin',
};

export const lookupMimeType = (filePath: string) => {
  const match = /\.([^.]+)$/.exec(filePath.trim().toLowerCase());
  if (!match) {
    return false;
  }

  return extensionToMimeType[match[1]] || false;
};

export const mimeTypeExtension = (contentType: string) => {
  const normalizedType = contentType.split(';', 1)[0]?.trim().toLowerCase();
  if (!normalizedType) {
    return false;
  }

  if (mimeTypeToExtension[normalizedType]) {
    return mimeTypeToExtension[normalizedType];
  }

  const subtype = normalizedType.split('/')[1];
  return subtype?.split('+').pop() || false;
};
