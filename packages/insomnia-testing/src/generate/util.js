// @flow

export function escapeJsStr(s: string): string {
  return s.replace(/'/g, `\\'`);
}

export function indent(level: number, code: string): string {
  return code
    .split('\n')
    .map(line => tabs(level) + line)
    .join('\n');
}

export function tabs(level: number): string {
  let tabs = '';
  for (let i = 0; i < level; i++) {
    tabs += '  ';
  }
  return tabs;
}
