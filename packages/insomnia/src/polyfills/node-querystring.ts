/**
 * Minimal polyfill for Node.js's legacy `querystring` module.
 * Used in the renderer (nodeIntegration: false) by third-party packages like httpsnippet.
 */

export function stringify(obj: Record<string, any>, sep = '&', eq = '='): string {
  if (!obj || typeof obj !== 'object') {
    return '';
  }
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => encodeURIComponent(k) + eq + encodeURIComponent(String(v)))
    .join(sep);
}

export function parse(str: string, sep = '&', eq = '='): Record<string, string> {
  if (!str) {
    return {};
  }
  return Object.fromEntries(
    str.split(sep).filter(Boolean).map(pair => {
      const idx = pair.indexOf(eq);
      if (idx === -1) {
        return [decodeURIComponent(pair), ''];
      }
      return [decodeURIComponent(pair.slice(0, idx)), decodeURIComponent(pair.slice(idx + 1))];
    }),
  );
}

export function escape(str: string): string {
  return encodeURIComponent(String(str));
}

export function unescape(str: string): string {
  return decodeURIComponent(str);
}

export default { stringify, parse, escape, unescape };
