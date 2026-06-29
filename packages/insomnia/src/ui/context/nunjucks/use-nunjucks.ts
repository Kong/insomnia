import { useCallback } from 'react';

import { getRenderContext, getRenderContextAncestors, render } from '~/common/render';
import { NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME } from '~/common/templating/constants';
import type { HandleRender, RenderContextOptions } from '~/common/templating/types';
import { getKeys } from '~/common/templating/utils';
import { useWorkspaceLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { useRequestLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import { useRequestGroupLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.$requestGroupId';

let getRenderContextPromiseCache: any = {};

export interface UseNunjucksOptions {
  renderContext: Pick<Partial<RenderContextOptions>, 'purpose' | 'extraInfo'>;
}
export const initializeNunjucksRenderPromiseCache = () => {
  getRenderContextPromiseCache = {};
};

initializeNunjucksRenderPromiseCache();

/**
 * Access to functions useful for Nunjucks rendering
 */
export const useNunjucks = (options?: UseNunjucksOptions) => {
  // for all types of requests
  const requestData = useRequestLoaderData();
  // for request group (folder)
  const { activeRequestGroup } = useRequestGroupLoaderData() || {};
  const workspaceData = useWorkspaceLoaderData();

  const fetchRenderContext = useCallback(async () => {
    const ancestors = await getRenderContextAncestors(
      requestData?.activeRequest || activeRequestGroup || workspaceData?.activeWorkspace,
    );
    return getRenderContext({
      request: requestData?.activeRequest || undefined,
      environment: workspaceData?.activeEnvironment._id,
      ancestors,
      ...options?.renderContext,
    });
  }, [
    requestData?.activeRequest,
    workspaceData?.activeWorkspace,
    workspaceData?.activeEnvironment._id,
    options?.renderContext,
    activeRequestGroup,
  ]);

  const handleGetRenderContext = useCallback(
    async (contextCacheKey?: string) => {
      const context =
        contextCacheKey && getRenderContextPromiseCache[contextCacheKey]
          ? await getRenderContextPromiseCache[contextCacheKey]
          : await fetchRenderContext();
      const keys = getKeys(context, NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME);
      return { context, keys };
    },
    [fetchRenderContext],
  );
  /**
   * Heavily optimized render function
   *
   * @param text - template to render
   * @param contextCacheKey - if rendering multiple times in parallel, set this
   * @returns {Promise}
   * @private
   */
  const handleRender: HandleRender = useCallback(
    async <T>(obj: T, contextCacheKey: string | null = null) => {
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
    },
    [fetchRenderContext],
  );

  return {
    handleRender,
    handleGetRenderContext,
  };
};
