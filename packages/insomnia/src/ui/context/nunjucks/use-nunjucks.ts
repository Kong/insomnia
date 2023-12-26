import { useCallback } from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import { getRenderContext, getRenderContextAncestors, HandleGetRenderContext, HandleRender, render } from '../../../common/render';
import * as models from '../../../models';
import { Response } from '../../../models/response';
import { NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME } from '../../../templating';
import { getKeys } from '../../../templating/utils';
import { RequestLoaderData } from '../../routes/request';
import { WorkspaceLoaderData } from '../../routes/workspace';
let getRenderContextPromiseCache: any = {};

export const initializeNunjucksRenderPromiseCache = () => {
  getRenderContextPromiseCache = {};
};

initializeNunjucksRenderPromiseCache();

/**
 * Access to functions useful for Nunjucks rendering
 */
export const useNunjucks = () => {
  const requestData = useRouteLoaderData('request/:requestId') as RequestLoaderData | undefined;
  const workspaceData = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;

  const fetchRenderContext = useCallback(async (fieldSource?: string, source?: any) => {
    const ancestors = await getRenderContextAncestors(requestData?.activeRequest || workspaceData?.activeWorkspace);

    const environmentId = workspaceData.activeEnvironment?._id;
    let dataset;
    let hasFieldSourceFlg = true;
    if (fieldSource === 'request') {
      if (source) {
        dataset = await models.requestDataset.getOrCreateForRequestId(source._id);
        return getRenderContext({
          request: source, environmentId, ancestors, dataset,
        });
      }
    } else if (fieldSource === 'response') {
      if (source) {
        const response = (source as Response);
        const baseDataset = await models.requestDataset.getOrCreateForRequestId(response.parentId);
        const requestDataset = await models.requestDataset.getById(response.dataset?._id || 'n/a');
        const environment = Object.assign(
          {},
          baseDataset?.environment,
          requestDataset?.environment,
          response.dataset?.environment,
        );
        dataset = Object.assign(
          {},
          response.dataset,
          { environment },
        );
        if (dataset) {
          return getRenderContext({
            request: source, environmentId, ancestors, dataset,
          });
        } else {
          source = null;
        }
      }
    } else {
      hasFieldSourceFlg = false;
    }
    if (!source && hasFieldSourceFlg && requestData?.activeRequest) {
      dataset = await models.requestDataset.getOrCreateForRequestId(requestData?.activeRequest._id);
      return getRenderContext({
        request: requestData?.activeRequest, environmentId, ancestors, dataset,
      });
    }

    return getRenderContext({
      request: requestData?.activeRequest || undefined,
      environmentId: workspaceData?.activeEnvironment._id,
      ancestors,
    });
  }, [requestData?.activeRequest, workspaceData?.activeWorkspace, workspaceData?.activeEnvironment._id]);

  const handleGetRenderContext = (fieldSource?: string, request?: Request | null) => {
    return _handleGetRenderContext(fieldSource || 'request', request);
  };

  const _handleGetRenderContext: HandleGetRenderContext = useCallback(async (fieldSource?: string, source?: any) => {
    const context = await fetchRenderContext(fieldSource, source);
    const keys = getKeys(context, NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME);
    return { context, keys };
  }, [fetchRenderContext]);

  /**
   * Heavily optimized render function
   *
   * @param text - template to render
   * @param contextCacheKey - if rendering multiple times in parallel, set this
   * @returns {Promise}
   * @private
   */
  const handleRender = (object: any, contextCacheKey?: string | null, fieldSource?: string | null, request?: Request | null) => {
    return _handleRender(object, contextCacheKey, fieldSource || 'request', request);
  };

  const _handleRender: HandleRender = useCallback(async <T>(obj: T, contextCacheKey: string | null = null, fieldSource?: string | null, source?: any) => {
    if (!contextCacheKey || !getRenderContextPromiseCache[contextCacheKey]) {
      // NOTE: We're caching promises here to avoid race conditions
      // @ts-expect-error -- TSCONVERSION contextCacheKey being null used as object index
      getRenderContextPromiseCache[contextCacheKey] = fetchRenderContext(fieldSource, source);
    }
    // Set timeout to delete the key eventually
    // @ts-expect-error -- TSCONVERSION contextCacheKey being null used as object index
    setTimeout(() => delete getRenderContextPromiseCache[contextCacheKey], 5000);
    // @ts-expect-error -- TSCONVERSION contextCacheKey being null used as object index
    const context = await getRenderContextPromiseCache[contextCacheKey];
    return render(obj, context);
  }, [fetchRenderContext]);

  return {
    handleRender,
    handleGetRenderContext,
  };
};
