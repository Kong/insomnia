import type { BinaryToTextEncoding } from 'node:crypto';
import crypto from 'node:crypto';
import os from 'node:os';

import iconv from 'iconv-lite';

import { jarFromCookies } from '~/common/cookies';
import { services } from '~/insomnia-data';
import { getBodyBuffer } from '~/models/helpers/response-operations';

import { database as db } from '../common/database';
import * as models from '../models/index';
import type { Request } from '../models/request';
import type { RequestGroup } from '../models/request-group';
import type { Workspace } from '../models/workspace';
import * as pluginApp from '../plugins/context/app';
import * as pluginNetwork from '../plugins/context/network';
import * as pluginStore from '../plugins/context/store';
import type { Plugin } from '../plugins/index';
import * as templating from './index';
import type { BaseRenderContext, PluginTemplateTag, PluginTemplateTagContext } from './types';
import { decodeEncoding } from './utils';

const EMPTY_ARG = '__EMPTY_NUNJUCKS_ARG__';

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
      .slice(0, -1)
      .filter(a => a !== EMPTY_ARG)
      .map(decodeEncoding);
    // Define a helper context with utils
    const helperContext: PluginTemplateTagContext = {
      ...pluginApp.init(),
      // @ts-expect-error -- TSCONVERSION
      ...pluginStore.init(this._plugin),
      ...pluginNetwork.init(),
      context: renderContext,
      meta: renderMeta,
      renderPurpose,
      util: {
        nodeOS: async () => {
          return {
            arch: os.arch(),
            platform: os.platform(),
            release: os.release(),
            cpus: os.cpus(),
            hostname: os.hostname(),
            freemem: os.freemem(),
            userInfo: os.userInfo(),
          };
        },
        readFile: async (path: string) => window.main.secureReadFile({ path }),
        decode: async (buffer: Buffer, encoding = 'utf8') => iconv.decode(buffer, encoding),
        encode: async (input: string, encoding: BinaryToTextEncoding) =>
          crypto.createHash('md5').update(input).digest(encoding),
        render: (str: string) =>
          templating.render(str, {
            context: renderContext,
          }),
        openInBrowser: (url: string) => window.main.openInBrowser(url),
        models: {
          request: {
            getById: models.request.getById,
            getAncestors: async (request: any) => {
              const ancestors = await db.withAncestors<Request | RequestGroup | Workspace>(request, [
                models.requestGroup.type,
                models.workspace.type,
              ]);
              return ancestors.filter(doc => doc._id !== request._id);
            },
          },
          cloudCredential: {
            getById: services.cloudCredential.getById,
            update: services.cloudCredential.update,
          },
          workspace: {
            getById: models.workspace.getById,
          },
          oAuth2Token: {
            getByRequestId: services.oAuth2Token.getByParentId,
          },
          cookieJar: {
            getOrCreateForParentId: (parentId: string) => {
              return models.cookieJar.getOrCreateForParentId(parentId);
            },
            getCookiesForUrl: async (parentId: string, url: string) => {
              const cookies = await models.cookieJar.getOrCreateForParentId(parentId);
              const jar = jarFromCookies(cookies.cookies);
              return jar.getCookiesSync(url);
            },
          },
          response: {
            getLatestForRequestId: models.response.getLatestForRequestId,
            getBodyBuffer,
          },
          settings: {
            get: services.settings.get,
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
