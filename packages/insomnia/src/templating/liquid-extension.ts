import type { BinaryToTextEncoding } from 'node:crypto';
import crypto from 'node:crypto';
import os from 'node:os';

import iconv from 'iconv-lite';
import type { Request, RequestGroup, Workspace } from 'insomnia-data';
import { models, services } from 'insomnia-data';
import type { Context, Emitter, Liquid, TagToken, TopLevelToken } from 'liquidjs';
import { Tag } from 'liquidjs';

import { jarFromCookies } from '~/common/cookies';
import type { Plugin } from '~/common/plugins/types';
import type { BaseRenderContext, PluginTemplateTag, PluginTemplateTagContext } from '~/common/templating/types';
import { decodeEncoding, tokenizeArgs } from '~/common/templating/utils';

import { database as db } from '../common/database';
import * as pluginApp from '../plugins/context/app';
import * as pluginNetwork from '../plugins/context/network';
import * as pluginStore from '../plugins/context/store';

function resolveArg(arg: ReturnType<typeof tokenizeArgs>[number], scope: Record<string, any>): any {
  if (arg.type === 'variable') {
    return scope[arg.value as string];
  }
  return arg.value;
}

export function createLiquidTag(
  ext: PluginTemplateTag,
  plugin: Plugin,
  renderFn?: (str: string, opts: { context: Record<string, any> }) => Promise<string | null>,
): typeof Tag {
  class InsomniTag extends Tag {
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
      const args = parsedArgs.map(a => resolveArg(a, scope)).map(decodeEncoding);

      const helperContext: PluginTemplateTagContext = {
        ...pluginApp.init(),
        ...pluginStore.init(plugin),
        ...pluginNetwork.init(),
        context: renderContext,
        meta: renderMeta,
        renderPurpose,
        util: {
          nodeOS: async () => ({
            arch: os.arch(),
            platform: os.platform(),
            release: os.release(),
            cpus: os.cpus(),
            hostname: os.hostname(),
            freemem: os.freemem(),
            userInfo: os.userInfo(),
          }),
          readFile: async (path: string) => window.main.secureReadFile({ path }),
          decode: async (buffer: Buffer, encoding = 'utf8') => iconv.decode(buffer, encoding),
          encode: async (input: string, encoding: BinaryToTextEncoding) =>
            crypto.createHash('md5').update(input).digest(encoding),
          render: (str: string) => (renderFn ? renderFn(str, { context: renderContext }) : Promise.resolve(str)),
          openInBrowser: (url: string) => window.main.openInBrowser(url),
          models: {
            request: {
              getById: services.request.getById,
              getAncestors: async (request: any) => {
                const ancestors = await db.withAncestors<Request | RequestGroup | Workspace>(request, [
                  models.requestGroup.type,
                  models.workspace.type,
                ]);
                return ancestors.filter((doc: any) => doc._id !== request._id);
              },
            },
            cloudCredential: {
              getById: services.cloudCredential.getById,
              update: services.cloudCredential.update,
            },
            workspace: {
              getById: services.workspace.getById,
            },
            oAuth2Token: {
              getByRequestId: services.oAuth2Token.getByParentId,
            },
            cookieJar: {
              getOrCreateForParentId: (parentId: string) => services.cookieJar.getOrCreateForParentId(parentId),
              getCookiesForUrl: async (parentId: string, url: string) => {
                const cookies = await services.cookieJar.getOrCreateForParentId(parentId);
                const jar = jarFromCookies(cookies.cookies);
                return jar.getCookiesSync(url).map(c => c.toJSON());
              },
            },
            response: {
              getLatestForRequestId: services.response.getLatestForRequestId,
              getBodyBuffer: services.helpers.getResponseBodyBuffer,
            },
            settings: {
              get: services.settings.get,
            },
          },
        },
      };

      const result = await Promise.resolve(ext.run(helperContext, ...args));
      emitter.write(result == null ? '' : String(result));
    }
  }

  // Expose metadata so getTagDefinitions() can introspect
  (InsomniTag as any).metadata = ext;

  return InsomniTag;
}
