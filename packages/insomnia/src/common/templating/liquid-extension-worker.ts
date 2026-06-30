import type { CloudProviderCredential, Request, RequestGroup, Response, Workspace } from 'insomnia-data';
import type { Context, Emitter, Liquid, TagToken, TopLevelToken } from 'liquidjs';
import { Tag } from 'liquidjs';

import type { Plugin } from '~/common/plugins/types';

import packageJson from '../../../package.json';
import { resolveArg } from './resolve-arg';
import { tokenizeArgs } from './tokenize-args';
import type {
  BaseRenderContext,
  NodeCurlRequestOptions,
  PluginTemplateTag,
  PluginTemplateTagContext,
  PluginToMainAPIPaths,
} from './types';
export function decodeEncodingWorker<T>(value: T) {
  if (typeof value !== 'string') {
    return value;
  }

  const results = value.match(/^b64::(.+)::46b$/);

  if (results) {
    const base64 = results[1];
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array([...binary].map(char => char?.codePointAt(0) || 0));
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
  let result;
  try {
    result = await resp.json();
  } catch {}
  if (!resp.ok) {
    throw new Error(result?.error || JSON.stringify(result));
  }
  return result;
};

export function createLiquidTagWorker(
  ext: PluginTemplateTag,
  plugin: Plugin,
  renderFn?: (str: string, opts: { context: Record<string, any> }) => Promise<string | null>,
): typeof Tag {
  class InsomniWorkerTag extends Tag {
    private rawArgs: string;

    constructor(token: TagToken, remainTokens: TopLevelToken[], liquid: Liquid) {
      super(token, remainTokens, liquid);
      this.rawArgs = token.args;
    }

    async render(ctx: Context, emitter: Emitter): Promise<void> {
      const scope = ctx.getAll() as Record<string, any>;
      const renderContext = scope as BaseRenderContext & { value: string | number };
      const renderMeta = renderContext.getMeta?.();
      const renderPurpose = renderContext.getPurpose?.();

      const parsedArgs = tokenizeArgs(this.rawArgs);
      const args = (await Promise.all(parsedArgs.map(a => resolveArg(a, ctx, this.liquid)))).map(decodeEncodingWorker);

      const platform = ({ MacIntel: 'darwin', Win32: 'win32' }[globalThis.navigator?.platform ?? ''] ||
        'linux') as NodeJS.Platform;

      const helperContext: PluginTemplateTagContext = {
        app: {
          alert: async (title: string, message?: string) =>
            fetchFromTemplateWorkerDatabase('app.alert', { title, message }),
          dialog: async (title: string) => fetchFromTemplateWorkerDatabase('app.dialog', { title }),
          prompt: async (
            title: string,
            options?: { label?: string; defaultValue?: string; submitName?: string; inputType?: string },
          ) => fetchFromTemplateWorkerDatabase('app.prompt', { title, options }),
          getPath: async (name: string) => fetchFromTemplateWorkerDatabase('app.getPath', { name }),
          getInfo: () => ({ version: packageJson.version, platform }),
          showSaveDialog: async (options?: { defaultPath?: string }) =>
            fetchFromTemplateWorkerDatabase('app.showSaveDialog', { options }),
          clipboard: {
            readText: async () => fetchFromTemplateWorkerDatabase('app.clipboard.readText', {}),
            writeText: async (text: string) => fetchFromTemplateWorkerDatabase('app.clipboard.writeText', { text }),
            clear: async () => fetchFromTemplateWorkerDatabase('app.clipboard.clear', {}),
          },
        },
        store: {
          hasItem: async (key: string) =>
            fetchFromTemplateWorkerDatabase('pluginData.hasItem', { pluginName: plugin?.name, key }),
          setItem: async (key: string, value: string) =>
            fetchFromTemplateWorkerDatabase('pluginData.setItem', { pluginName: plugin?.name, key, value }),
          getItem: async (key: string) =>
            fetchFromTemplateWorkerDatabase('pluginData.getItem', { pluginName: plugin?.name, key }),
          removeItem: async (key: string) =>
            fetchFromTemplateWorkerDatabase('pluginData.removeItem', { pluginName: plugin?.name, key }),
          clear: async () => fetchFromTemplateWorkerDatabase('pluginData.removeItem', { pluginName: plugin?.name }),
          all: async (): Promise<{ key: string; value: string }[]> =>
            fetchFromTemplateWorkerDatabase('pluginData.getItem', { pluginName: plugin?.name }),
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
          readFile: async (path: string, encoding?: string) =>
            fetchFromTemplateWorkerDatabase('readFile', { path, encoding }),
          nodeOS: async () => fetchFromTemplateWorkerDatabase('nodeOS', {}),
          decode: async (buffer: Buffer, encoding?: string) =>
            fetchFromTemplateWorkerDatabase('decode', { buffer, encoding }),
          encode: async (input: string, encoding?: string) =>
            fetchFromTemplateWorkerDatabase('encode', { input, encoding }),
          render: (str: string) => (renderFn ? renderFn(str, { context: renderContext }) : Promise.resolve(str)),
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
              getCookiesForUrl: async (parentId: string, url: string) =>
                fetchFromTemplateWorkerDatabase('cookieJar.getCookiesForUrl', { parentId, url }),
            },
            response: {
              getLatestForRequestId: async (requestId: string, environmentId: string | null) =>
                fetchFromTemplateWorkerDatabase('response.getLatestForRequestId', {
                  requestId,
                  environmentId,
                }),
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

      const result = await Promise.resolve(ext.run(helperContext, ...args));
      emitter.write(result == null ? '' : String(result));
    }
  }

  (InsomniWorkerTag as any).metadata = ext;

  return InsomniWorkerTag;
}
