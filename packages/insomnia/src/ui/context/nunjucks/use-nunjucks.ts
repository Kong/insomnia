import { useCallback, useEffect, useRef } from 'react';

import { getRenderContext, getRenderContextAncestors, render } from '~/common/render';
import { useWorkspaceLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { useRequestLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import { useRequestGroupLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.$requestGroupId';
import { NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME } from '~/templating';
import type { BaseRenderContext, HandleRender, RenderContextOptions } from '~/templating/types';
import { getKeys } from '~/templating/utils';

interface CacheOptions {
  //If true, will cache the render context
  enableCache?: boolean;
  //Cache duration in seconds, default is 5 seconds
  cacheDuration?: number;
}
export type UseNunjucksOptions = {
  renderContext?: Pick<Partial<RenderContextOptions>, 'purpose' | 'extraInfo'>;
} & CacheOptions;

const defaultCacheDurationInSeconds = 5;
/**
 *
 * Customized hook simplifies template rendering in React components by:
 * - Retrieving render context based on current request/folder/workspace
 * - Providing optional caching to optimize performance and avoid race conditions
 * - Managing cache lifecycle
 *
 * @param options - Configuration options for rendering and caching
 * @param options.renderContext.purpose - Purpose of the render operation (e.g., 'send', 'preview')
 * @param options.renderContext.extraInfo - Additional information to include in render context
 * @param options.enableCache - Whether to cache the render context. Mainly used for editors with many nunjucks to render
 * @param options.cacheDuration - How long to keep the cached context in seconds (default: 5)
 *
 */
export const useNunjucks = (options?: UseNunjucksOptions) => {
  // for all types of requests
  const requestData = useRequestLoaderData();
  // for request group (folder)
  const { activeRequestGroup } = useRequestGroupLoaderData() || {};
  const workspaceData = useWorkspaceLoaderData();
  const { enableCache = false, cacheDuration = defaultCacheDurationInSeconds } = options || {};
  const renderContextPromiseCache = useRef<Promise<BaseRenderContext>>();
  const renderContextPromiseCacheTimer = useRef<ReturnType<typeof setTimeout>>();

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
    activeRequestGroup,
    workspaceData?.activeWorkspace,
    workspaceData?.activeEnvironment._id,
    options?.renderContext,
    activeRequestGroup,
  ]);

  const handleGetRenderContext = useCallback(async () => {
    const context =
      enableCache && renderContextPromiseCache.current
        ? await renderContextPromiseCache.current
        : await fetchRenderContext();
    const keys = getKeys(context, NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME);
    return { context, keys };
  }, [enableCache, fetchRenderContext]);
  /**
   * Heavily optimized render function
   *
   * @param text - template to render
   * @returns {Promise}
   * @private
   */
  const handleRender: HandleRender = useCallback(
    async <T>(obj: T) => {
      let getOrCreateRenderContext: ReturnType<typeof fetchRenderContext>;
      if (enableCache) {
        if (!renderContextPromiseCache.current) {
          // create a new context promise to optimize performance and avoid race conditions
          console.log(`[templating] Create Nunjucks render context cache`);
          renderContextPromiseCache.current = fetchRenderContext();
          // Implement time-based cache invalidation strategy for performance optimization:
          // 1. Cache the render context to avoid expensive re-computation for multiple nunjucks
          // 2. Set timeout to clear cache after specified duration to ensure context freshness
          // 3. This pattern is mainly used for editors that render many nunjucks simultaneously
          //    (e.g., code-editor, one-line-editor)
          // 4. With this approach, all templates rendered during the cache window share the same
          //    context promise, avoiding redundant context creation and race conditions
          renderContextPromiseCacheTimer.current = setTimeout(() => {
            console.log(`[templating] Remove Nunjucks render context cache`);
            renderContextPromiseCache.current = undefined;
          }, cacheDuration * 1000);
        }
        getOrCreateRenderContext = renderContextPromiseCache.current;
      } else {
        getOrCreateRenderContext = fetchRenderContext();
      }
      const context = await getOrCreateRenderContext;
      return render({ obj, context });
    },
    [enableCache, fetchRenderContext, cacheDuration],
  );

  useEffect(() => {
    const timer = renderContextPromiseCacheTimer.current;
    return () => {
      console.log(`[templating] Clear Nunjucks render context cache on unmount`);
      // clear timeout when unmount
      timer && clearTimeout(timer);
      renderContextPromiseCache.current = undefined;
    };
  }, []);

  return {
    handleRender,
    handleGetRenderContext,
  };
};
