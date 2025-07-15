export function safeToUseInsomniaFileName(fileName: string) {
  const fileNameWithoutExt = fileName.replace('.yaml', '').replace('.yml', '');
  const fileNameWithSafeCharacters = fileNameWithoutExt
    .toLowerCase()
    .trim()
    // Replace all non-alphanumeric characters with underscores, allow -
    .replace(/[^a-z0-9_-]/g, '_');

  return fileNameWithSafeCharacters;
}

export function safeToUseInsomniaFileNameWithExt(fileName: string) {
  return `${safeToUseInsomniaFileName(fileName)}.yaml`;
}
