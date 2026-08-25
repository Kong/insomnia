// Ensure trusted origin insomnia-app.local.
export function isTrustedAppOrigin(url: string, appUrl: string): boolean {
  try {
    return new URL(url).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}
