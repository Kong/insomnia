import type { RequestBodyParameter } from 'insomnia-data';

export const SEPARATOR = ':';
export const DISABLED_PREFIX = '//';

export const BULK_EDIT_PLACEHOLDER = [
  'Rows are separated by new lines',
  `Keys and values are separated by ${SEPARATOR}`,
  `Prepend ${DISABLED_PREFIX} to any row you want to add but keep disabled`,
].join('\n');

const DISABLED_PATTERN = /^\s*\/\/ ?/;
const LINE_ENDING = /\r\n|\r|\n/;

// Serializing these names would not parse back to itself: the separator splits the name, a leading
// `//` reads as the disabled marker, and surrounding whitespace is trimmed.
const hasUnrepresentableName = (name: string): boolean =>
  name !== name.trim() || name.includes(SEPARATOR) || DISABLED_PATTERN.test(name);

const isUnrepresentable = (pair: RequestBodyParameter): boolean =>
  pair.type === 'file' ||
  Boolean(pair.multiline) ||
  hasUnrepresentableName(pair.name || '') ||
  /[\n\r]/.test(pair.value || '');

const isBlank = (pair: Pick<RequestBodyParameter, 'name' | 'value'>): boolean => !pair.name && !pair.value;

export const serializePairs = (pairs: RequestBodyParameter[]): string =>
  pairs
    .filter(pair => !isUnrepresentable(pair) && !isBlank(pair))
    .map(pair => `${pair.disabled ? DISABLED_PREFIX : ''}${pair.name}${SEPARATOR}${pair.value || ''}`)
    .join('\n');

export const parsePairs = (text: string, previous: RequestBodyParameter[] = []): RequestBodyParameter[] => {
  const pairs: RequestBodyParameter[] = [];

  for (const line of text.split(LINE_ENDING)) {
    if (!line.trim()) {
      continue;
    }

    const disabled = DISABLED_PATTERN.test(line);
    const row = disabled ? line.replace(DISABLED_PATTERN, '') : line;

    const separatorIndex = row.indexOf(SEPARATOR);
    const name = (separatorIndex === -1 ? row : row.slice(0, separatorIndex)).trim();
    // Unlike header values, form-data values are opaque bytes, so this one is never trimmed.
    const value = separatorIndex === -1 ? '' : row.slice(separatorIndex + SEPARATOR.length);

    if (isBlank({ name, value })) {
      continue;
    }

    pairs.push({ name, value, disabled });
  }

  const carriedIds = previous.filter(pair => !isUnrepresentable(pair) && !isBlank(pair)).map(pair => pair.id);
  pairs.forEach((pair, index) => {
    if (carriedIds[index]) {
      pair.id = carriedIds[index];
    }
  });

  previous.forEach((pair, index) => {
    if (isUnrepresentable(pair)) {
      pairs.splice(Math.min(index, pairs.length), 0, pair);
    }
  });

  return pairs;
};
