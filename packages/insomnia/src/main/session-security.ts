import { type Session } from 'electron';

/**
 * Session permission posture for the main renderer.
 *
 * The Electron security checklist (item 5, "Handle session permission requests
 * from remote content") recommends explicitly handling permission requests
 * rather than relying on Chromium's defaults, which auto-approve several
 * permissions for loaded content.
 *
 * The renderer is first-party content, but it has no legitimate need for
 * camera, microphone, geolocation, notifications, MIDI, etc. We therefore deny
 * by default and allow only the small set the app actually uses.
 *
 * Clipboard write backs `navigator.clipboard.writeText` (e.g. the "copy routes"
 * action in the project navigation sidebar). `clipboard-read` is included so a
 * future paste affordance does not silently fail; remove it if unused.
 *
 * This module is intentionally free of side effects so the allow-list logic can
 * be unit tested (see `session-security.test.ts`).
 */
export const ALLOWED_PERMISSIONS = ['clipboard-read', 'clipboard-sanitized-write'] as const;

export const isPermissionAllowed = (permission: string): boolean =>
  (ALLOWED_PERMISSIONS as readonly string[]).includes(permission);

/**
 * Register deny-by-default permission handlers on the given session.
 * Denied requests are logged so unexpected requests are diagnosable.
 */
export function registerPermissionHandlers(targetSession: Session): void {
  targetSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const granted = isPermissionAllowed(permission);
    if (!granted) {
      console.log(`[security] Denied permission request: ${permission}`);
    }
    callback(granted);
  });

  targetSession.setPermissionCheckHandler((_webContents, permission) => isPermissionAllowed(permission));
}
