// @flow
import type { Request } from '../models/request';
import type { BaseModel } from '../models/index';

import { setDefaultProtocol } from 'insomnia-url';
import clone from 'clone';
import * as models from '../models';
import { CONTENT_TYPE_GRAPHQL } from '../common/constants';
import * as db from './database';
import * as templating from '../templating';
import type { CookieJar } from '../models/cookie-jar';
import type { Environment } from '../models/environment';

export const KEEP_ON_ERROR = 'keep';
export const THROW_ON_ERROR = 'throw';

export type RenderPurpose = 'send' | 'general';

export const RENDER_PURPOSE_SEND: RenderPurpose = 'send';
export const RENDER_PURPOSE_GENERAL: RenderPurpose = 'general';

export type RenderedRequest = Request & {
  cookies: Array<{ name: string, value: string, disabled?: boolean }>,
  cookieJar: CookieJar
};

export async function buildRenderContext(
  ancestors: Array<BaseModel> | null,
  rootEnvironment: Environment | null,
  subEnvironment: Environment | null,
  baseContext: Object = {}
): Object {
  const envObjects = [];

  if (rootEnvironment) {
    envObjects.push(rootEnvironment.data);
  }

  if (subEnvironment) {
    envObjects.push(subEnvironment.data);
  }

  for (const doc of (ancestors || []).reverse()) {
    const environment = (doc: any).environment;
    if (typeof environment === 'object' && environment !== null) {
      envObjects.push(environment);
    }
  }

  // At this point, environments is a list of environments ordered
  // from top-most parent to bottom-most child
  // Do an Object.assign, but render each property as it overwrites. This
  // way we can keep same-name variables from the parent context.
  const renderContext = baseContext;
  for (const envObject: Object of envObjects) {
    const keys = _getOrderedEnvironmentKeys(envObject);
    for (const key of keys) {
      /*
       * If we're overwriting a string, try to render it first using the same key from the base
       * environment to support same-variable recursion. This allows for the following scenario:
       *
       * base:  { base_url: 'google.com' }
       * obj:   { base_url: '{{ base_url }}/foo' }
       * final: { base_url: 'google.com/foo' }
       *
       * A regular Object.assign would yield { base_url: '{{ base_url }}/foo' } and the
       * original base_url of google.com would be lost.
       */
      if (typeof renderContext[key] === 'string') {
        const isSelfRecursive = envObject[key].match(`{{ ?${key}[ |][^}]*}}`);

        if (isSelfRecursive) {
          // If we're overwriting a variable that contains itself, make sure we
          // render it first
          renderContext[key] = await render(
            envObject[key],
            renderContext, // Only render with key being overwritten
            null,
            KEEP_ON_ERROR,
            'Environment'
          );
        } else {
          // Otherwise it's just a regular replacement
          renderContext[key] = envObject[key];
        }
      } else {
        renderContext[key] = envObject[key];
      }
    }
  }

  // Render the context with itself to fill in the rest.
  let finalRenderContext = renderContext;

  // Render recursive references.
  const keys = _getOrderedEnvironmentKeys(finalRenderContext);
  for (let i = 0; i < 3; i++) {
    for (const key of keys) {
      finalRenderContext[key] = await render(
        finalRenderContext[key],
        finalRenderContext,
        null,
        KEEP_ON_ERROR,
        'Environment'
      );
    }
  }

  return finalRenderContext;
}

/**
 * Recursively render any JS object and return a new one
 * @param {*} obj - object to render
 * @param {object} context - context to render against
 * @param blacklistPathRegex - don't render these paths
 * @param errorMode - how to handle errors
 * @param name - name to include in error message
 * @return {Promise.<*>}
 */
export async function render<T>(
  obj: T,
  context: Object = {},
  blacklistPathRegex: RegExp | null = null,
  errorMode: string = THROW_ON_ERROR,
  name: string = ''
): Promise<T> {
  // Make a deep copy so no one gets mad :)
  const newObj = clone(obj);

  async function next(x: any, path: string, first: boolean = false): Promise<any> {
    if (blacklistPathRegex && path.match(blacklistPathRegex)) {
      return x;
    }

    const asStr = Object.prototype.toString.call(x);

    // Leave these types alone
    if (
      asStr === '[object Date]' ||
      asStr === '[object RegExp]' ||
      asStr === '[object Error]' ||
      asStr === '[object Boolean]' ||
      asStr === '[object Number]' ||
      asStr === '[object Null]' ||
      asStr === '[object Undefined]'
    ) {
      // Do nothing to these types
    } else if (typeof x === 'string') {
      try {
        x = await templating.render(x, { context, path });

        // If the variable outputs a tag, render it again. This is a common use
        // case for environment variables:
        //   {{ foo }} => {% uuid 'v4' %} => dd265685-16a3-4d76-a59c-e8264c16835a
        if (x.includes('{%')) {
          x = await templating.render(x, { context, path });
        }
      } catch (err) {
        if (errorMode !== KEEP_ON_ERROR) {
          throw err;
        }
      }
    } else if (Array.isArray(x)) {
      for (let i = 0; i < x.length; i++) {
        x[i] = await next(x[i], `${path}[${i}]`);
      }
    } else if (typeof x === 'object' && x !== null) {
      // Don't even try rendering disabled objects
      // Note, this logic probably shouldn't be here, but w/e for now
      if (x.disabled) {
        return x;
      }

      const keys = Object.keys(x);
      for (const key of keys) {
        if (first && key.indexOf('_') === 0) {
          x[key] = await next(x[key], path);
        } else {
          const pathPrefix = path ? path + '.' : '';
          x[key] = await next(x[key], `${pathPrefix}${key}`);
        }
      }
    }

    return x;
  }

  return next(newObj, name, true);
}

export async function getRenderContext(
  request: Request,
  environmentId: string,
  ancestors: Array<BaseModel> | null = null,
  purpose: string | null = null
): Promise<Object> {
  if (!ancestors) {
    ancestors = await db.withAncestors(request, [
      models.request.type,
      models.requestGroup.type,
      models.workspace.type
    ]);
  }

  const workspace = ancestors.find(doc => doc.type === models.workspace.type);
  if (!workspace) {
    throw new Error('Failed to render. Could not find workspace');
  }

  const rootEnvironment = await models.environment.getOrCreateForWorkspaceId(
    workspace ? workspace._id : 'n/a'
  );
  const subEnvironment = await models.environment.getById(environmentId);

  // Add meta data helper function
  const baseContext = {};
  baseContext.getMeta = () => ({
    requestId: request ? request._id : null,
    workspaceId: workspace ? workspace._id : 'n/a'
  });

  baseContext.getPurpose = () => purpose;

  // Generate the context we need to render
  return buildRenderContext(ancestors, rootEnvironment, subEnvironment, baseContext);
}

export async function getRenderedRequestAndContext(
  request: Request,
  environmentId: string,
  purpose?: string
): Promise<{ request: RenderedRequest, context: Object }> {
  const ancestors = await db.withAncestors(request, [
    models.request.type,
    models.requestGroup.type,
    models.workspace.type
  ]);
  const workspace = ancestors.find(doc => doc.type === models.workspace.type);
  const parentId = workspace ? workspace._id : 'n/a';
  const cookieJar = await models.cookieJar.getOrCreateForParentId(parentId);

  const renderContext = await getRenderContext(request, environmentId, ancestors, purpose);

  // HACK: Switch '#}' to '# }' to prevent Nunjucks from barfing
  // https://github.com/getinsomnia/insomnia/issues/895
  try {
    if (request.body.text && request.body.mimeType === CONTENT_TYPE_GRAPHQL) {
      const o = JSON.parse(request.body.text);
      o.query = o.query.replace(/#}/g, '# }');
      request.body.text = JSON.stringify(o);
    }
  } catch (err) {}

  // Render all request properties
  const renderResult = await render(
    { _request: request, _cookieJar: cookieJar },
    renderContext,
    request.settingDisableRenderRequestBody ? /^body.*/ : null
  );

  const renderedRequest = renderResult._request;
  const renderedCookieJar = renderResult._cookieJar;

  // Remove disabled params
  renderedRequest.parameters = renderedRequest.parameters.filter(p => !p.disabled);

  // Remove disabled headers
  renderedRequest.headers = renderedRequest.headers.filter(p => !p.disabled);

  // Remove disabled body params
  if (renderedRequest.body && Array.isArray(renderedRequest.body.params)) {
    renderedRequest.body.params = renderedRequest.body.params.filter(p => !p.disabled);
  }

  // Remove disabled authentication
  if (renderedRequest.authentication && renderedRequest.authentication.disabled) {
    renderedRequest.authentication = {};
  }

  // Default the proto if it doesn't exist
  renderedRequest.url = setDefaultProtocol(renderedRequest.url);

  return {
    context: renderContext,
    request: {
      // Add the yummy cookies
      // TODO: Eventually get rid of RenderedRequest type and put these elsewhere
      cookieJar: renderedCookieJar,
      cookies: [],
      isPrivate: false,

      // NOTE: Flow doesn't like Object.assign, so we have to do each property manually
      // for now to convert Request to RenderedRequest.
      _id: renderedRequest._id,
      authentication: renderedRequest.authentication,
      body: renderedRequest.body,
      created: renderedRequest.created,
      modified: renderedRequest.modified,
      description: renderedRequest.description,
      headers: renderedRequest.headers,
      metaSortKey: renderedRequest.metaSortKey,
      method: renderedRequest.method,
      name: renderedRequest.name,
      parameters: renderedRequest.parameters,
      parentId: renderedRequest.parentId,
      settingDisableRenderRequestBody: renderedRequest.settingDisableRenderRequestBody,
      settingEncodeUrl: renderedRequest.settingEncodeUrl,
      settingSendCookies: renderedRequest.settingSendCookies,
      settingStoreCookies: renderedRequest.settingStoreCookies,
      settingRebuildPath: renderedRequest.settingRebuildPath,
      settingMaxTimelineDataSize: renderedRequest.settingMaxTimelineDataSize,
      type: renderedRequest.type,
      url: renderedRequest.url
    }
  };
}

export async function getRenderedRequest(
  request: Request,
  environmentId: string,
  purpose?: string
): Promise<RenderedRequest> {
  const result = await getRenderedRequestAndContext(request, environmentId, purpose);
  return result.request;
}

/**
 * Sort the keys that may have Nunjucks last, so that other keys get
 * defined first. Very important if env variables defined in same obj
 * (eg. {"foo": "{{ bar }}", "bar": "Hello World!"})
 *
 * @param v
 * @returns {number}
 */
function _nunjucksSortValue(v) {
  if (v && v.match && v.match(/({%)/)) {
    return 3;
  } else if (v && v.match && v.match(/({{)/)) {
    return 2;
  } else {
    return 1;
  }
}

function _getOrderedEnvironmentKeys(finalRenderContext: Object): Array<string> {
  return Object.keys(finalRenderContext).sort((k1, k2) => {
    const k1Sort = _nunjucksSortValue(finalRenderContext[k1]);
    const k2Sort = _nunjucksSortValue(finalRenderContext[k2]);
    return k1Sort - k2Sort;
  });
}
