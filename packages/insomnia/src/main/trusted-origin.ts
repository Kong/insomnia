// Ensure trusted origin insomnia-app.local.
export function isTrustedAppOrigin(url: string, appUrl: string): boolean {
  try {
    const parsed = new URL(url);
    // blob:/data:/javascript: report a spoofable .origin string, not a real match.
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    return parsed.origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}
