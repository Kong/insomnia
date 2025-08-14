import packageJson from '../../package.json';
import type { CloudProviderCredential } from '../models/cloud-credential';
import type { Request } from '../models/request';
import type { RequestGroup } from '../models/request-group';
import type { Response } from '../models/response';
import type { Workspace } from '../models/workspace';
import type { NodeCurlRequestOptions } from '../plugins/context/network';
import type { Plugin } from '../plugins/index';
import type { BaseRenderContext, PluginTemplateTag, PluginTemplateTagContext, PluginToMainAPIPaths } from './types';
import * as templating from './worker';
export function decodeEncoding<T>(value: T) {
  if (typeof value !== 'string') {
    return value;
  }

  const results = value.match(/^b64::(.+)::46b$/);

  if (results) {
    const base64 = results[1];
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array([...binary].map(char => char.charCodeAt(0)));
      return new TextDecoder().decode(bytes);
    } catch (e) {
      console.error('Invalid base64 string:', e);
      return value;
    }
  }

  return value;
}
export const fetchFromTemplateWorkerDatabase = async (path: PluginToMainAPIPaths, body: any) => {
  const resp = await fetch('insomnia-templating-worker-database://' + path, {
    method: 'post',
    body: JSON.stringify(body),
  });
  const result = await resp.json();
  if (!resp.ok) {
    throw new Error(result?.error || JSON.stringify(result));
  }
  return result;
};
const EMPTY_ARG = '__EMPTY_NUNJUCKS_ARG__';
const legacyModeErrorMessage = `This version improves the security around plugins by limiting scope of access by default. This may break some plugins which rely on having the same kind of access Insomnia does. You can still grant elevated access to plugins, should your workflow absolutely require it, by navigating to Preferences > Plugins and checking the box enabling elevated access for plugins.`;
export default class BaseExtension {
  _ext: PluginTemplateTag | null = null;
  _plugin: Plugin | null = null;
  tags: PluginTemplateTag['name'][] = [];

  constructor(ext: PluginTemplateTag, plugin: Plugin) {
    this._ext = ext;
    this._plugin = plugin;
    const tag = this.getTag();
    this.tags = [...(tag === null ? [] : [tag])];
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
    return this._ext?.liveDisplayName || (() => '');
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

  run(context: PluginTemplateTagContext, ...arg: any[]) {
    return this._ext?.run(context, ...arg);
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

  asyncRun({ ctx }: any, ...runArgs: any[]) {
    const renderContext = ctx as BaseRenderContext & { value: string | number };
    const callback = runArgs[runArgs.length - 1];
    const renderMeta = renderContext.getMeta?.();
    const renderPurpose = renderContext.getPurpose?.();
    // Extract the rest of the args
    const args = runArgs
      .slice(0, runArgs.length - 1)
      .filter(a => a !== EMPTY_ARG)
      .map(decodeEncoding);
    const platform = ({ MacIntel: 'darwin', Win32: 'win32' }[globalThis.navigator.platform] ||
      'linux') as NodeJS.Platform;
    // Define a helper context with utils
    const helperContext: PluginTemplateTagContext = {
      app: {
        alert: () => {
          throw new Error(legacyModeErrorMessage);
        },
        dialog: () => {
          throw new Error(legacyModeErrorMessage);
        },
        prompt: () => {
          throw new Error(legacyModeErrorMessage);
        },
        getPath: () => {
          throw new Error(legacyModeErrorMessage);
        },
        getInfo: () => ({
          version: packageJson.version,
          platform,
        }),
        showSaveDialog: async () => {
          throw new Error(legacyModeErrorMessage);
        },
        clipboard: {
          readText: () => {
            throw new Error(legacyModeErrorMessage);
          },
          writeText: () => {
            throw new Error(legacyModeErrorMessage);
          },
          clear: () => {
            throw new Error(legacyModeErrorMessage);
          },
        },
      },
      store: {
        hasItem: async (key: string) =>
          fetchFromTemplateWorkerDatabase('pluginData.hasItem', { pluginName: this._plugin?.name, key }),
        setItem: async (key: string, value: string) =>
          fetchFromTemplateWorkerDatabase('pluginData.setItem', { pluginName: this._plugin?.name, key, value }),
        getItem: async (key: string) =>
          fetchFromTemplateWorkerDatabase('pluginData.getItem', { pluginName: this._plugin?.name, key }),
        removeItem: async (key: string) =>
          fetchFromTemplateWorkerDatabase('pluginData.removeItem', { pluginName: this._plugin?.name, key }),
        clear: async () => fetchFromTemplateWorkerDatabase('pluginData.removeItem', { pluginName: this._plugin?.name }),
        all: async (): Promise<{ key: string; value: string }[]> =>
          fetchFromTemplateWorkerDatabase('pluginData.getItem', { pluginName: this._plugin?.name }),
      },
      network: {
        sendRequest: async (request: Request, extraInfo?: { requestChain: string[] }): Promise<Response> =>
          fetchFromTemplateWorkerDatabase('network.sendRequest', { request, extraInfo }),
        sendRequestWithoutSideEffects: async (options: NodeCurlRequestOptions) =>
          fetchFromTemplateWorkerDatabase('network.sendRequestWithoutSideEffects', { options }),
      },
      context: renderContext,
      meta: renderMeta,
      renderPurpose,
      util: {
        readFile: async (path: string, encoding?: string) => {
          const allowed = renderContext?.getSettings().dataFolders.some((folder: string) => folder !== '' && path.startsWith(folder));
          if (!allowed) {
            throw `Insomnia cannot access the file ‘${path}’. You can adjust this in Preferences → Security.`;
          }
          return fetchFromTemplateWorkerDatabase('readFile', { path, encoding });
        },
        nodeOS: async () => fetchFromTemplateWorkerDatabase('nodeOS', {}),
        decode: async (buffer: Buffer, encoding?: string) =>
          fetchFromTemplateWorkerDatabase('decode', { buffer, encoding }),
        render: (str: string) => templating.render(str, { context: renderContext }),
        openInBrowser: (url: string) => fetchFromTemplateWorkerDatabase('openInBrowser', { url }),
        models: {
          request: {
            getById: async (id: string) => fetchFromTemplateWorkerDatabase('request.getById', { id }),
            getAncestors: async (request: any) => {
              const ancestors = (await fetchFromTemplateWorkerDatabase('request.getAncestors', {
                request,
                types: ['RequestGroup', 'Workspace'],
              })) as (Request | RequestGroup | Workspace)[];
              return ancestors.filter(doc => doc._id !== request._id);
            },
          },
          cloudCredential: {
            getById: async (id: string) => fetchFromTemplateWorkerDatabase('cloudCredential.getById', { id }),
            update: async (originCredential: CloudProviderCredential, patch: Partial<CloudProviderCredential>) =>
              fetchFromTemplateWorkerDatabase('cloudCredential.update', { originCredential, patch }),
          },
          workspace: {
            getById: async (id: string) => fetchFromTemplateWorkerDatabase('workspace.getById', { id }),
          },
          oAuth2Token: {
            getByRequestId: async (parentId: string) =>
              fetchFromTemplateWorkerDatabase('oAuth2Token.getByRequestId', { parentId }),
          },
          cookieJar: {
            getOrCreateForParentId: async (parentId: string) =>
              fetchFromTemplateWorkerDatabase('cookieJar.getOrCreateForParentId', { parentId }),
          },
          response: {
            getLatestForRequestId: async (requestId: string, environmentId: string | null) =>
              fetchFromTemplateWorkerDatabase('response.getLatestForRequestId', { requestId, environmentId }),
            getBodyBuffer: async (
              response?: { bodyPath?: string; bodyCompression?: 'zip' | null | '__NEEDS_MIGRATION__' | undefined },
              readFailureValue?: string,
            ) => fetchFromTemplateWorkerDatabase('response.getBodyBuffer', { response, readFailureValue }),
          },
          settings: {
            get: async () => fetchFromTemplateWorkerDatabase('settings.get', {}),
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
