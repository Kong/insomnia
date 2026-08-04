// Dynamic parity detector for createLiquidTag's `models` object (liquid-extension.ts). Liquid-syntax
// tags bypass the sandboxed Nunjucks bridge (templating-worker-database.ts's pluginToMainAPI)
// entirely — no capability gating, and historically none of that bridge's point-patches either. See
// CROSS-TENANT-DB-ACCESS-FINDINGS.md Finding 1. This scans the *real* `models` object built by
// createLiquidTag (captured via a real render — see the accompanying test — never a
// reimplementation) for the same protection patterns already proven necessary on the Nunjucks bridge.

/** One entry in the parity surface: a models.* path and whether it carries the expected protection. */
export interface LiquidParitySurfaceEntry {
  key: string;
  protected: boolean;
}

const getPath = (obj: Record<string, any> | undefined, dotted: string): unknown =>
  dotted.split('.').reduce<any>((o, k) => o?.[k], obj);

// A caller-supplied id/parentId/requestId/environmentId-shaped argument must be coerced with
// String(...) before reaching services.* — mirrors Finding 6's coercion sweep on the Nunjucks bridge.
const COERCION_KEYS = [
  'request.getById',
  'workspace.getById',
  'oAuth2Token.getByRequestId',
  'cookieJar.getOrCreateForParentId',
  'cookieJar.getCookiesForUrl',
  'response.getLatestForRequestId',
  'cloudCredential.getById',
] as const;

// `services.*` is a lazily-resolved Proxy (packages/insomnia-data/src/services/index.ts) — every
// property access returns a freshly-built generic dispatcher closure, so a bare, unpatched reference
// like `getById: services.request.getById` stringifies to *that dispatcher's* source, not the real
// `request.getById` implementation. That generic source happens to contain `String(serviceName)` /
// `String(methodName)` for its own error messages — coincidentally matching a naive `/String\(/` scan
// even though the caller's actual id argument was never coerced. Recognize that dispatcher by its
// own distinctive error text and treat it as unprotected regardless of the incidental match.
const isRawServiceProxyDispatcher = (src: string): boolean =>
  /Service not initialized/.test(src) || /is not callable/.test(src);

const isCoercionProtected = (fn: unknown): boolean => {
  if (typeof fn !== 'function') {
    return false;
  }
  const src = fn.toString();
  return !isRawServiceProxyDispatcher(src) && /String\(/.test(src);
};

// cloudCredential.update must reuse the shared reload-by-id + strip-identity-fields helper (Finding
// 4's fix) rather than reimplementing the pattern independently — checking for the helper's name
// keeps this detector honest about "the same code path", not just "some structurally similar patch".
const isCloudCredentialUpdateProtected = (fn: unknown): boolean =>
  typeof fn === 'function' && /reloadCloudCredentialForTrustedUpdate/.test(fn.toString());

// response.getBodyBuffer must reuse the shared id-reload-when-available helper (Item 1's fix) for the
// same reason.
const isResponseGetBodyBufferProtected = (fn: unknown): boolean =>
  typeof fn === 'function' && /readResponseBodyBufferOwned/.test(fn.toString());

/** Describes every tracked models.* path's protection status against a real, captured `models` object. */
export const describeLiquidParitySurface = (models: Record<string, any>): LiquidParitySurfaceEntry[] => [
  ...COERCION_KEYS.map(key => ({ key, protected: isCoercionProtected(getPath(models, key)) })),
  {
    key: 'cloudCredential.update',
    protected: isCloudCredentialUpdateProtected(getPath(models, 'cloudCredential.update')),
  },
  {
    key: 'response.getBodyBuffer',
    protected: isResponseGetBodyBufferProtected(getPath(models, 'response.getBodyBuffer')),
  },
];

/** Flags every tracked models.* path missing its expected protection. */
export const findUnprotectedLiquidModelKeys = (models: Record<string, any>): string[] =>
  describeLiquidParitySurface(models).filter(e => !e.protected).map(e => e.key);
