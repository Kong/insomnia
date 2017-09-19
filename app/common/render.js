// @flow
import type {Request} from '../models/request';
import type {BaseModel} from '../models/index';

import clone from 'clone';
import * as models from '../models';
import {setDefaultProtocol} from './misc';
import * as db from './database';
import * as templating from '../templating';
import type {CookieJar} from '../models/cookie-jar';

export const KEEP_ON_ERROR = 'keep';
export const THROW_ON_ERROR = 'throw';

export type RenderedRequest = Request & {
  cookies: Array<{name: string, value: string, disabled?: boolean}>,
  cookieJar: CookieJar
};

export async function buildRenderContext (
  ancestors: Array<BaseModel> | null,
  rootEnvironment: {data: Object},
  subEnvironment: {data: Object},
  baseContext: Object = {}
): Object {
  const environments = [];

  if (rootEnvironment) {
    environments.push(rootEnvironment.data);
  }

  if (subEnvironment) {
    environments.push(subEnvironment.data);
  }

  for (const doc of (ancestors || []).reverse()) {
    if (typeof doc.environment === 'object' && doc.environment !== null) {
      environments.push(doc.environment);
    }
  }

  // At this point, environments is a list of environments ordered
  // from top-most parent to bottom-most child
  // Do an Object.assign, but render each property as it overwrites. This
  // way we can keep same-name variables from the parent context.
  const renderContext = baseContext;
  for (const environment: Object of environments) {
    // Sort the keys that may have Nunjucks last, so that other keys get
    // defined first. Very important if env variables defined in same obj
    // (eg. {"foo": "{{ bar }}", "bar": "Hello World!"})
    const keys = Object.keys(environment).sort((k1, k2) => {
      if (typeof environment[k1] === 'string') {
        return environment[k1].match(/({{)/) ? 1 : -1;
      } else {
        return 0;
      }
    });

    for (const key of keys) {
      /*
       * If we're overwriting a string, try to render it first with the base as
       * a context. This allows for the following scenario:
       *
       * base:  { base_url: 'google.com' }
       * obj:   { base_url: '{{ base_url }}/foo' }
       * final: { base_url: 'google.com/foo' }
       *
       * A regular Object.assign would yield { base_url: '{{ base_url }}/foo' } and the
       * original base_url of google.com would be lost.
       */
      if (typeof renderContext[key] === 'string') {
        renderContext[key] = await render(
          environment[key],
          renderContext,
          null,
          KEEP_ON_ERROR,
          'Environment'
        );
      } else {
        renderContext[key] = environment[key];
      }
    }
  }

  // Render the context with itself to fill in the rest.
  let finalRenderContext = renderContext;

  // Render recursive references.
  for (let i = 0; i < 3; i++) {
    finalRenderContext = await render(
      finalRenderContext,
      finalRenderContext,
      null,
      KEEP_ON_ERROR,
      'Environment'
    );
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
export async function render<T> (
  obj: T,
  context: Object = {},
  blacklistPathRegex: RegExp | null = null,
  errorMode: string = THROW_ON_ERROR,
  name: string = ''
): Promise<T> {
  // Make a deep copy so no one gets mad :)
  const newObj = clone(obj);

  async function next (x: any, path: string = name): Promise<any> {
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
        x = await templating.render(x, {context, path});

        // If the variable outputs a tag, render it again. This is a common use
        // case for environment variables:
        //   {{ foo }} => {% uuid 'v4' %} => dd265685-16a3-4d76-a59c-e8264c16835a
        if (x.includes('{%')) {
          x = await templating.render(x, {context, path});
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
        const pathPrefix = path ? path + '.' : '';
        x[key] = await next(x[key], `${pathPrefix}${key}`);
      }
    }

    return x;
  }

  return next(newObj);
}

export async function getRenderContext (
  request: Request,
  environmentId: string,
  ancestors: Array<BaseModel> | null = null
): Promise<Object> {
  if (!request) {
    return {};
  }

  if (!ancestors) {
    ancestors = await db.withAncestors(request, [
      models.requestGroup.type,
      models.workspace.type
    ]);
  }

  const workspace = ancestors.find(doc => doc.type === models.workspace.type);
  const rootEnvironment = await models.environment.getOrCreateForWorkspace(workspace);
  const subEnvironment = await models.environment.getById(environmentId);

  // Add meta data helper function
  const baseContext = {};
  baseContext.getMeta = () => ({
    requestId: request._id,
    workspaceId: workspace ? workspace._id : 'n/a'
  });

  // Generate the context we need to render
  const context = await buildRenderContext(
    ancestors,
    rootEnvironment,
    subEnvironment,
    baseContext
  );

  return context;
}

export async function getRenderedRequest (
  request: Request,
  environmentId: string
): Promise<RenderedRequest> {
  const ancestors = await db.withAncestors(request, [
    models.requestGroup.type,
    models.workspace.type
  ]);
  const workspace = ancestors.find(doc => doc.type === models.workspace.type);
  const parentId = workspace ? workspace._id : 'n/a';
  const cookieJar = await models.cookieJar.getOrCreateForParentId(parentId);

  const renderContext = await getRenderContext(request, environmentId, ancestors);

  // Render all request properties
  const renderedRequest = await render(
    request,
    renderContext,
    request.settingDisableRenderRequestBody ? /^body.*/ : null
  );

  // Render cookies
  const renderedCookieJar = await render(
    cookieJar,
    renderContext
  );

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
    // Add the yummy cookies
    // TODO: Eventually get rid of RenderedRequest type and put these elsewhere
    cookieJar: renderedCookieJar,
    cookies: [],

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
    type: renderedRequest.type,
    url: renderedRequest.url
  };
}
