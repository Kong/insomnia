import nunjucks from 'nunjucks';

import { database as db } from '../common/database';
import * as models from '../models/index';
import { BaseModel } from '../models/index';
import { Workspace } from '../models/workspace';
import { Plugin } from '../plugins';
import * as pluginContexts from '../plugins/context';
import { PluginTemplateFilter, PluginTemplateFilterContext } from './extensions';
import * as templating from './index';
import { decodeEncoding } from './utils';

const EMPTY_ARG = '__EMPTY_NUNJUCKS_ARG__';

export default class BaseFilter {
  _ft: PluginTemplateFilter | null = null;
  _plugin: Plugin | null = null;
  constructor(ft: PluginTemplateFilter, plugin: Plugin | null) {
    this._ft = ft;
    this._plugin = plugin;
  }

  static newFilter(ft: PluginTemplateFilter, plugin: Plugin, nj: nunjucks.Environment) {
    const filter = new BaseFilter(ft, plugin);
    filter.addFilter(nj);
  }

  static newCustomFilter(ft: PluginTemplateFilter, nj: nunjucks.Environment) {
    const filter = new BaseFilter(ft, null);
    filter.addFilter(nj);
  }

  getName() {
    return this._ft?.name || 'no-name-filter';
  }

  getDisplayName() {
    return this._ft?.displayName || this.getName();
  }

  getDescription() {
    return this._ft?.description || 'no description';
  }

  getArgs() {
    return this._ft?.args || [];
  }

  addFilter(nj: nunjucks.Environment) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const _thisInstance = this;
    nj.addFilter(this.getName(), function(this: any, ...args: string[]) {
    // TODO: will be left here until found a solution
      _thisInstance.asyncRun.call(_thisInstance, this, ...args);
    }, true);
    const njContext = (nj as any);
    njContext.filtersList = njContext.filtersList || [];
    njContext.filtersList.push(this);
  }

  run(ctx: PluginTemplateFilterContext, strValue: string, ...args: any[]) {
    return this._ft?.run(ctx, strValue, ...args);
  }

  asyncRun({ ctx: renderContext }: any, strValue: string, ...runArgs: any) {
    // Pull the callback off the end
    const callback = runArgs[runArgs.length - 1];
    // Pull out the meta helper
    const renderMeta = renderContext.getMeta ? renderContext.getMeta() : {};
    // Pull out the purpose
    const renderPurpose = renderContext.getPurpose ? renderContext.getPurpose() : null;
    // Pull out the environment ID
    const environmentId = renderContext.getEnvironmentId ? renderContext.getEnvironmentId() : 'n/a';
    renderMeta.environmentId = environmentId;
    // Extract the rest of the args
    const args = runArgs
      .slice(0, runArgs.length - 1)
      .filter((a: any) => a !== EMPTY_ARG)
      .map(decodeEncoding);
    const pluginData = this._plugin ? pluginContexts.store.init(this._plugin) : {};
    // Define a helper context with utils
    const helperContext: PluginTemplateFilterContext = {
      ...pluginContexts.app.init(renderPurpose),
      ...pluginData,
      ...pluginContexts.network.init(),
      meta: renderMeta,
      context: renderContext,
      util: {
        render: (str: string, extContext: object) => {
          let templateContext = {
            ...renderContext,
          };
          if (extContext && typeof extContext === 'object') {
            templateContext = {
              ...templateContext,
              ...extContext,
            };
          }
          return templating.render(str, {
            context: templateContext,
          });
        },
        models: {
          request: {
            getById: models.request.getById,
            getAncestors: async (request: BaseModel) => {
              const ancestors = await db.withAncestors(request, [
                models.requestGroup.type,
                models.workspace.type,
              ]);
              return ancestors.filter(doc => doc._id !== request._id);
            },
          },
          workspace: {
            getById: models.workspace.getById,
          },
          oAuth2Token: {
            getByRequestId: models.oAuth2Token.getByParentId,
          },
          cookieJar: {
            getOrCreateForWorkspace: (workspace: Workspace) => {
              return models.cookieJar.getOrCreateForParentId(workspace._id);
            },
          },
          response: {
            getAvailablesRequestId: models.response.getAvailablesForRequest,
            getLatestForRequestId: models.response.getLatestForRequest,
            getBodyBuffer: models.response.getBodyBuffer,
          },
        },
      },
    };
    let result;

    try {
      result = this.run(helperContext, strValue, ...args);
    } catch (err) {
      // Catch sync errors
      callback(err);
      return;
    }

    // If the result is a promise, resolve it async
    if (result instanceof Promise) {
      result
        .then(r => {
          callback(null, r);
        })
        .catch(err => {
          callback(err);
        });
    } else {
      // If the result is not a Promise, return it synchronously
      callback(null, result);
    }
  }
}
