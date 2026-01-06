import type { Merge } from 'type-fest';

import { CONTENT_TYPE_FORM_URLENCODED, getContentTypeFromHeaders } from '~/common/constants';
import { newDefaultRegistry } from '~/common/hotkeys';
import type { KeyboardShortcut } from '~/common/settings';
import * as models from '~/models';
import type { CookieJar } from '~/models/cookie-jar';
import type { Request } from '~/models/request';
import type { Response } from '~/models/response';
import type { Settings } from '~/models/settings';
import type { Workspace } from '~/models/workspace';
import { WorkspaceScopeKeys } from '~/models/workspace';
import { deconstructQueryStringToParams } from '~/utils/url/querystring';
// TODO: deprecate these
export const legacyMigrations = (doc: any) => {
  try {
    switch (doc.type) {
      case 'CookieJar': {
        return migrateCookieId(doc);
      }
      case 'Request': {
        return migrateAuthType(migrateWeirdUrls(migrateBody(doc)));
      }
      case 'Response': {
        return migrateBodyCompression(doc);
      }
      case 'Settings': {
        return migrateEnsureHotKeys(doc);
      }
      case 'Workspace': {
        return _migrateScope(_migrateEnsureName(_migrateExtractClientCertificates(doc)));
      }
      default: {
        return doc;
      }
    }
  } catch (e) {
    console.log('[db] Error during migration', e);
    throw e;
  }
};

/** Ensure every cookie has an ID property */
function migrateCookieId(cookieJar: CookieJar) {
  for (const cookie of cookieJar.cookies) {
    if (!cookie.id) {
      cookie.id = crypto.randomUUID();
    }
  }

  return cookieJar;
}

function migrateBodyCompression(doc: Response) {
  if (doc.bodyCompression === '__NEEDS_MIGRATION__') {
    doc.bodyCompression = 'zip';
  }

  return doc;
}

/**
 * Migrate old body (string) to new body (object)
 * @param request
 */
function migrateBody(request: Request) {
  if (request.body && typeof request.body === 'object') {
    return request;
  }

  // Second, convert all existing urlencoded bodies to new format
  const contentType = getContentTypeFromHeaders(request.headers) || '';
  const wasFormUrlEncoded = !!contentType.match(/^application\/x-www-form-urlencoded/i);

  if (wasFormUrlEncoded) {
    // Convert old-style form-encoded request bodies to new style
    request.body = {
      mimeType: CONTENT_TYPE_FORM_URLENCODED,
      params: deconstructQueryStringToParams(typeof request.body === 'string' ? request.body : '', false),
    };
  } else if (!request.body && !contentType) {
    request.body = {};
  } else {
    const rawBody: string = typeof request.body === 'string' ? request.body : '';
    request.body =
      typeof contentType !== 'string'
        ? {
            text: rawBody,
          }
        : {
            mimeType: contentType.split(';')[0],
            text: rawBody,
          };
  }

  return request;
}

/**
 * Fix some weird URLs that were caused by an old bug
 * @param request
 */
function migrateWeirdUrls(request: Request) {
  // Some people seem to have requests with URLs that don't have the indexOf
  // function. This should clear that up. This can be removed at a later date.
  if (typeof request.url !== 'string') {
    request.url = '';
  }

  return request;
}

/**
 * Ensure the request.authentication.type property is added
 * @param request
 */
function migrateAuthType(request: Request) {
  const isAuthSet = request?.authentication && 'username' in request.authentication && request.authentication.username;
  // @ts-expect-error -- old model
  if (isAuthSet && !request.authentication.type) {
    // @ts-expect-error -- old model
    request.authentication.type = 'basic';
  }

  return request;
}
/**
 * Ensure map is updated when new hotkeys are added
 */
function migrateEnsureHotKeys(settings: Settings): Settings {
  const defaultHotKeyRegistry = newDefaultRegistry();

  // Remove any hotkeys that are no longer in the default registry
  const hotKeyRegistry = (Object.keys(settings.hotKeyRegistry) as KeyboardShortcut[]).reduce(
    (newHotKeyRegistry, key) => {
      if (key in defaultHotKeyRegistry) {
        newHotKeyRegistry[key] = settings.hotKeyRegistry[key];
      }

      return newHotKeyRegistry;
    },
    {} as Settings['hotKeyRegistry'],
  );

  settings.hotKeyRegistry = { ...defaultHotKeyRegistry, ...hotKeyRegistry };
  return settings;
}

function _migrateExtractClientCertificates(workspace: Workspace) {
  const certificates = workspace.certificates || null;

  if (!Array.isArray(certificates)) {
    // Already migrated
    return workspace;
  }

  for (const cert of certificates) {
    models.clientCertificate.create({
      parentId: workspace._id,
      host: cert.host || '',
      passphrase: cert.passphrase || null,
      cert: cert.cert || null,
      key: cert.key || null,
      pfx: cert.pfx || null,
      isPrivate: false,
    });
  }

  delete workspace.certificates;
  // This will remove the now-missing `certificates` property
  // NOTE: Using db.update so we don't change things like modified time
  return workspace;
}

/**
 * Ensure workspace has a valid String name. Due to real-world bug reports, we know
 * this happens (and it causes problems) so this migration will ensure that it is
 * corrected.
 */
function _migrateEnsureName(workspace: Workspace) {
  if (typeof workspace.name !== 'string') {
    workspace.name = 'My Workspace';
  }

  return workspace;
}

// Translate the old value
type OldScopeTypes = 'spec' | 'debug' | 'designer' | null;
type MigrationWorkspace = Merge<Workspace, { scope: OldScopeTypes | Workspace['scope'] }>;

/**
 * Ensure workspace scope is set to a valid entry
 */
function _migrateScope(workspace: MigrationWorkspace) {
  if (
    workspace.scope === WorkspaceScopeKeys.design ||
    workspace.scope === WorkspaceScopeKeys.collection ||
    workspace.scope === WorkspaceScopeKeys.mockServer ||
    workspace.scope === WorkspaceScopeKeys.environment ||
    workspace.scope === WorkspaceScopeKeys.mcp
  ) {
    return workspace as Workspace;
  }
  // designer and spec => design, unset => collection
  workspace.scope =
    workspace.scope === 'designer' || workspace.scope === 'spec'
      ? WorkspaceScopeKeys.design
      : WorkspaceScopeKeys.collection;
  return workspace as Workspace;
}
