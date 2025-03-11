
import type { PluginTemplateTag } from './extensions';
import * as templating from './worker';
export function decodeEncoding<T>(value: T) {
  if (typeof value !== 'string') {
    return value;
  }

  const results = value.match(/^b64::(.+)::46b$/);

  if (results) {
    return Buffer.from(results[1], 'base64').toString('utf8');
  }

  return value;
}
const EMPTY_ARG = '__EMPTY_NUNJUCKS_ARG__';
export interface HelperContext {
  context: any;
  meta: any;
  renderPurpose: any;
  util: any;
}
export default class BaseExtension {
  _ext: PluginTemplateTag | null = null;
  _plugin: Plugin | null = null;
  tags: PluginTemplateTag['name'][] = [];

  constructor(ext: PluginTemplateTag, plugin: Plugin) {
    this._ext = ext;
    this._plugin = plugin;
    const tag = this.getTag();
    this.tags = [
      ...(tag === null ? [] : [tag]),
    ];
  }

  getTag() {
    return this._ext?.name || null;
  }

  getPriority() {
    return this._ext?.priority || -1;
  }

  getName() {
    return typeof this._ext?.displayName === 'string' ? this._ext?.displayName : this.getTag();
  }

  getDescription() {
    return this._ext?.description || 'no description';
  }

  getLiveDisplayName() {
    return (
      // @ts-expect-error -- TSCONVERSION
      this._ext?.liveDisplayName ||
      (() => '')
    );
  }

  getDisablePreview() {
    return this._ext?.disablePreview || (() => false);
  }

  getArgs() {
    return this._ext?.args || [];
  }

  getActions() {
    return this._ext?.actions || [];
  }

  isDeprecated() {
    return this._ext?.deprecated || false;
  }

  run(...args: any[]) {
    // @ts-expect-error -- TSCONVERSION
    return this._ext?.run(...args);
  }

  parse(parser: any, nodes: any, lexer: any) {
    const tok = parser.nextToken();
    let args;

    if (parser.peekToken().type !== lexer.TOKEN_BLOCK_END) {
      args = parser.parseSignature(null, true);
    } else {
      // Not sure why this is needed, but it fails without it
      args = new nodes.NodeList(tok.lineno, tok.colno);
      args.addChild(new nodes.Literal(0, 0, EMPTY_ARG));
    }

    parser.advanceAfterBlockEnd(tok.value);
    return new nodes.CallExtensionAsync(this, 'asyncRun', args);
  }

  asyncRun({ ctx: renderContext }: any, ...runArgs: any[]) {
    // Pull the callback off the end
    const callback = runArgs[runArgs.length - 1];
    // Pull out the meta helper
    const renderMeta = renderContext.getMeta ? renderContext.getMeta() : {};
    // Pull out the purpose
    const renderPurpose = renderContext.getPurpose ? renderContext.getPurpose() : null;
    // Extract the rest of the args
    const args = runArgs
      .slice(0, runArgs.length - 1)
      .filter(a => a !== EMPTY_ARG)
      .map(decodeEncoding);
    // Define a helper context with utils
    const helperContext: HelperContext = {
      // ...pluginContexts.app.init(renderPurpose),
      // ...pluginContexts.store.init(this._plugin),
      // ...pluginContexts.network.init(),
      context: renderContext,
      meta: renderMeta,
      renderPurpose,
      util: {
        render: (str: string) =>
          templating.render(str, {
            context: renderContext,
          }),
        models: {
          request: {
            getById: async (id: string) => {
              const resp = await fetch('insomnia-templating-worker-database://request.getById', {
                method: 'post',
                body: JSON.stringify({ id }),
              });

              const req = await resp.json();
              return req;
            },
            getAncestors: async (request: any) => {
              const resp = await fetch('insomnia-templating-worker-database://request.getAncestors', {
                method: 'post',
                body: JSON.stringify({ request, types: ['RequestGroup', 'Workspace'] }),
              });

              const ancestors = await resp.json();
              return ancestors;
            },
          },
          workspace: {
            getById: async (id: string) => {
              const resp = await fetch('insomnia-templating-worker-database://workspace.getById', {
                method: 'post',
                body: JSON.stringify({ id }),
              });

              const workspace = await resp.json();
              return workspace;
            },
          },
          oAuth2Token: {
            getByRequestId: async (parentId: string) => {
              const resp = await fetch('insomnia-templating-worker-database://oAuth2Token.getByRequestId', {
                method: 'post',
                body: JSON.stringify({ parentId }),
              });

              const oAuth2Token = await resp.json();
              return oAuth2Token;
            },
          },
          cookieJar: {
            getOrCreateForWorkspace: async (workspace: any) => {
              const resp = await fetch('insomnia-templating-worker-database://cookieJar.getOrCreateForParentId', {
                method: 'post',
                body: JSON.stringify({ parentId: workspace._id }),
              });

              const cookieJar = await resp.json();
              return cookieJar;
            },
          },
          response: {
            getLatestForRequestId: async (requestId: string, environmentId: string | null) => {
              const resp = await fetch('insomnia-templating-worker-database://response.getLatestForRequestId', {
                method: 'post',
                body: JSON.stringify({ requestId, environmentId }),
              });

              const latest = await resp.json();
              return latest;
            },
            getBodyBuffer: async (response?: { bodyPath?: string; bodyCompression?: 'zip' | null | '__NEEDS_MIGRATION__' | undefined },
              readFailureValue?: string) => {
              const resp = await fetch('insomnia-templating-worker-database://response.getBodyBuffer', {
                method: 'post',
                body: JSON.stringify({ response, readFailureValue }),
              });

              const buffer = await resp.json();
              return buffer;
            },
          },
        },
      },
    };
    let result;

    try {
      result = this.run(helperContext, ...args);
    } catch (err) {
      // Catch sync errors
      callback(err);
      return;
    }

    // FIX THIS: this is throwing unhandled exceptions
    // If the result is a promise, resolve it async
    if (result instanceof Promise) {
      result
        .then(r => {
          callback(null, r);
        })
        .catch(err => {
          callback(err);
        });
      return;
    }

    // If the result is not a Promise, return it synchronously
    callback(null, result);
  }
}
