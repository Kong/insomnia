// Pure helpers for building the HTML response preview document. Kept free of
// Electron imports so they can be unit-tested in isolation.

const escapeHtmlAttribute = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Inject a `<base href>` (pointing at the request URL) into the response body's
 * `<head>` so relative asset URLs resolve. The href is HTML-escaped so a URL
 * containing a quote or angle bracket cannot break out of the attribute.
 */
export const buildPreviewHtml = (body: string, url: string) =>
  body.replace('<head>', `<head><base href="${escapeHtmlAttribute(url)}">`);
