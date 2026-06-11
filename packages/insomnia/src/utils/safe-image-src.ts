// Validates an image URL that originated from untrusted plugin metadata (npm/github) before it is
// used as an <img src>. Only absolute https URLs are allowed; this blocks XSS/exfil vectors such as
// javascript:, data:, file:, and plain http:. Returns the safe href, or undefined when the input is
// missing or unsafe (callers should render a fallback in that case).
export function safeImageSrc(raw?: string): string | undefined {
  if (!raw) {
    return undefined;
  }
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}
