// List of irregular whitespace characters adopted from https://eslint.org/docs/rules/no-irregular-whitespace#rule-details
const irregularWhitespaceCharacters = [
  '\u000B',
  '\u000C',
  '\u00A0',
  '\u0085',
  '\u1680',
  '\u180E',
  '\ufeff',
  '\u2000',
  '\u2001',
  '\u2002',
  '\u2003',
  '\u2004',
  '\u2005',
  '\u2006',
  '\u2007',
  '\u2008',
  '\u2009',
  '\u200A',
  '\u200B',
  '\u2028',
  '\u2029',
  '\u202F',
  '\u205f',
  '\u3000',
];

const irregularWhitespaceCharactersRegex = new RegExp(`[${irregularWhitespaceCharacters.join('')}]`);

export function normalizeIrregularWhitespace(text: string) {
  return text.replace(irregularWhitespaceCharactersRegex, ' ');
}
