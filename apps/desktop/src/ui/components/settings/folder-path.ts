const getPathRoot = (value: string) => {
  const windowsRootMatch = value.match(/^[A-Za-z]:\\/);
  if (windowsRootMatch) {
    return windowsRootMatch[0];
  }

  return value.startsWith('/') ? '/' : '';
};

const normalizePathSegments = (value: string, separator: '/' | '\\') => {
  const root = getPathRoot(value);
  const startIndex = root.length;
  const rawSegments = value
    .slice(startIndex)
    .split(/[\\/]+/)
    .filter(Boolean);
  const normalizedSegments: string[] = [];

  for (const segment of rawSegments) {
    if (segment === '.') {
      continue;
    }

    if (segment === '..') {
      if (normalizedSegments.length > 0 && normalizedSegments[normalizedSegments.length - 1] !== '..') {
        normalizedSegments.pop();
      } else if (!root) {
        normalizedSegments.push(segment);
      }
      continue;
    }

    normalizedSegments.push(segment);
  }

  const joinedSegments = normalizedSegments.join(separator);
  if (!root) {
    return joinedSegments;
  }

  return `${root}${joinedSegments}`;
};

export const normalizeFolderPath = (value: string) => {
  const separator = /^[A-Za-z]:[\\/]/.test(value) ? '\\' : '/';
  const collapsedSeparators = value.replace(/[\\/]+/g, separator);
  const normalized = normalizePathSegments(collapsedSeparators, separator);
  const root = getPathRoot(normalized);

  if (normalized === '' || normalized === root) {
    return root || normalized;
  }

  return normalized.replace(new RegExp(`${separator === '\\' ? '\\\\' : '/'}+$`), '');
};

export type FolderValidationResult = { ok: true; normalizedValue: string } | { ok: false; error: string };

export function validateFolderInput(input: string, existing: string[]): FolderValidationResult {
  const trimmed = input.trim();
  if (trimmed === '') {
    return { ok: false, error: 'Enter a folder path to add.' };
  }

  const normalized = normalizeFolderPath(trimmed);
  if (trimmed !== normalized) {
    return { ok: false, error: `Invalid folder path format. Did you mean "${normalized}"?` };
  }

  if (existing.some(value => normalizeFolderPath(value) === normalized)) {
    return { ok: false, error: 'Duplicate folders are not allowed.' };
  }

  return { ok: true, normalizedValue: normalized };
}
