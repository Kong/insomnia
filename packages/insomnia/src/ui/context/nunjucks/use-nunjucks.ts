import { useCallback } from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import { getRenderContext, getRenderContextAncestors, type HandleGetRenderContext, type HandleRender, render } from '../../../common/render';
import { NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME } from '../../../templating';
import { getKeys } from '../../../templating/utils';
import type { RequestLoaderData } from '../../routes/request';
import type { WorkspaceLoaderData } from '../../routes/workspace';
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

  const fetchRenderContext = useCallback(async () => {
    const ancestors = await getRenderContextAncestors(requestData?.activeRequest || workspaceData?.activeWorkspace);
    return getRenderContext({
      request: requestData?.activeRequest || undefined,
      environment: workspaceData?.activeEnvironment._id,
      ancestors,
    });
  }, [requestData?.activeRequest, workspaceData?.activeWorkspace, workspaceData?.activeEnvironment._id]);

  const handleGetRenderContext: HandleGetRenderContext = useCallback(async (contextCacheKey?: string) => {
    const context = contextCacheKey && getRenderContextPromiseCache[contextCacheKey] ?
      await await getRenderContextPromiseCache[contextCacheKey] : await fetchRenderContext();
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
  const handleRender: HandleRender = useCallback(async <T>(obj: T, contextCacheKey: string | null = null) => {
    if (!contextCacheKey || !getRenderContextPromiseCache[contextCacheKey]) {
      // NOTE: We're caching promises here to avoid race conditions
      // @ts-expect-error -- TSCONVERSION contextCacheKey being null used as object index
      getRenderContextPromiseCache[contextCacheKey] = fetchRenderContext();
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
