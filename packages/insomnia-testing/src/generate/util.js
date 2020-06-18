// @flow

export function escapeJsStr(s: string): string {
  return s.replace(/'/g, `\\'`);
}

export function indent(level: number, code: string, tab: string = '  '): string {
  if (!level || level < 0) {
    return code;
  }

  const prefix = new Array(level + 1).join('  ');
  return code
    .split('\n')
    .map(line => prefix + line)
    .join('\n');
}
