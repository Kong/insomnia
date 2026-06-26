/**
 * Content-Security-Policy for the main renderer (Electron security checklist
 * item 7, "Define a Content-Security-Policy").
 *
 * Shipped in REPORT-ONLY mode first. The renderer is a large, complex surface
 * (Monaco editor, web workers, analytics, OAuth flows, custom protocols) and an
 * over-strict enforcing policy would break flows silently. Report-only does not
 * block anything; instead Chromium logs each violation to the renderer console
 * ("[Report Only] Refused to ..."), so the policy can be tuned from real data
 * before a follow-up flips the header name to `Content-Security-Policy`.
 *
 * The directives below are a deliberately permissive first draft that encodes
 * current intent; tighten them as reports come in. Notable allowances:
 *  - `style-src 'unsafe-inline'`: Tailwind, Monaco and React inject inline styles.
 *  - `script-src 'wasm-unsafe-eval'`: allow WebAssembly without `'unsafe-eval'`.
 *  - `connect-src https: wss:`: covers the Insomnia API, analytics and Sentry
 *    ingest; enumerate concrete hosts before enforcing.
 *  - custom schemes back the SSE stream and templating-worker database.
 *
 * This module is intentionally free of side effects so the policy can be unit
 * tested (see `content-security-policy.test.ts`).
 */
export const CONTENT_SECURITY_POLICY_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https: wss: insomnia-event-source: insomnia-templating-worker-database:",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "frame-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

/** Report-only header: surfaces violations to the console without blocking. */
export const CSP_HEADER_NAME = 'Content-Security-Policy-Report-Only';

/**
 * Returns a copy of the given document-response headers with the report-only
 * CSP applied. CSP governs a document and all of its subresources, so this only
 * needs to be set on the top-level `index.html` response.
 */
export function withContentSecurityPolicy(responseHeaders: Headers): Headers {
  const headers = new Headers(responseHeaders);
  headers.set(CSP_HEADER_NAME, CONTENT_SECURITY_POLICY_REPORT_ONLY);
  return headers;
}
