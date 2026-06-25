const ALLOWED_PERMISSIONS = new Set<string>([
  'clipboard-sanitized-write',
]);

export function isPermissionAllowed(permission: string): boolean {
  return ALLOWED_PERMISSIONS.has(permission);
}
