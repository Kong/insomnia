const extensionToMimeType: Record<string, string> = {
  csv: 'text/csv',
  gif: 'image/gif',
  html: 'text/html',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  js: 'application/javascript',
  json: 'application/json',
  pdf: 'application/pdf',
  png: 'image/png',
  svg: 'image/svg+xml',
  txt: 'text/plain',
  xml: 'application/xml',
  yaml: 'application/yaml',
  yml: 'application/yaml',
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
