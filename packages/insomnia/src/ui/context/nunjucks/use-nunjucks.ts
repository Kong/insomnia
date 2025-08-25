import { useCallback, useEffect, useRef } from 'react';

import { getRenderContext, getRenderContextAncestors, render } from '~/common/render';
import { environment } from '~/models';
import { useWorkspaceLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { useRequestLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import { useRequestGroupLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.$requestGroupId';
import { NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME } from '~/templating';
import type { BaseRenderContext, HandleRender, RenderContextOptions } from '~/templating/types';
import { getKeys } from '~/templating/utils';

interface CacheOptions {
  //If true, will cache the render context
  enableCache?: boolean;
}
export type UseNunjucksOptions = {
  renderContext?: Pick<Partial<RenderContextOptions>, 'purpose' | 'extraInfo'>;
} & CacheOptions;

/**
 *
 * Customized hook simplifies template rendering in React components by:
 * - Retrieving render context based on current request/folder/workspace
 * - Providing optional caching to optimize performance and avoid race conditions
 * - Clear cache automatically when any of the environments change
 *
 * @param options - Configuration options for rendering and caching
 * @param options.renderContext.purpose - Purpose of the render operation (e.g., 'send', 'preview')
 * @param options.renderContext.extraInfo - Additional information to include in render context
 * @param options.enableCache - Whether to cache the render context. Mainly used for editors with many nunjucks to render
 *
 */
export const useNunjucks = (options?: UseNunjucksOptions) => {
  // for all types of requests
  const requestData = useRequestLoaderData();
  // for request group (folder)
  const { activeRequestGroup } = useRequestGroupLoaderData() || {};
  const workspaceData = useWorkspaceLoaderData();
  const { enableCache = false } = options || {};
  const renderContextPromiseCache = useRef<Promise<BaseRenderContext>>();

  const fetchRenderContext = useCallback(async () => {
    const ancestors = await getRenderContextAncestors(
      requestData?.activeRequest || activeRequestGroup || workspaceData?.activeWorkspace,
    );
    const baseEnvironment = workspaceData?.baseEnvironment;
    const activeGlobalEnvironment = workspaceData?.activeGlobalEnvironment;
    const isActiveGlobalBaseEnvironment = activeGlobalEnvironment?._id.startsWith('wrk_');

    return getRenderContext({
      request: requestData?.activeRequest || undefined,
      environment: workspaceData?.activeEnvironment,
      baseEnvironment,
      ...(activeGlobalEnvironment && {
        rootGlobalEnvironment: isActiveGlobalBaseEnvironment
          ? activeGlobalEnvironment
          : (await environment.getById(activeGlobalEnvironment.parentId))!,
        subGlobalEnvironment: isActiveGlobalBaseEnvironment ? undefined : activeGlobalEnvironment,
      }),
      ancestors,
      ...options?.renderContext,
    });
  }, [
    requestData?.activeRequest,
    activeRequestGroup,
    workspaceData?.activeWorkspace,
    workspaceData?.baseEnvironment,
    workspaceData?.activeGlobalEnvironment,
    workspaceData?.activeEnvironment,
    options?.renderContext,
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
      // Implement cache invalidation strategy for performance optimization:
      // 1. Cache the render context to avoid expensive re-computation for multiple nunjucks
      // 2. This pattern is mainly used for editors that render many nunjucks simultaneously
      //    (For example: code-editor, one-line-editor)
      // 3. With this approach, all templates rendered during the cache window share the same
      //    context promise, avoiding redundant context creation and race conditions
      if (enableCache) {
        if (!renderContextPromiseCache.current) {
          renderContextPromiseCache.current = fetchRenderContext();
        }
        getOrCreateRenderContext = renderContextPromiseCache.current;
      } else {
        getOrCreateRenderContext = fetchRenderContext();
      }
      const context = await getOrCreateRenderContext;
      return render(obj, context);
    },
    [enableCache, fetchRenderContext],
  );

  useEffect(() => {
    // Clean up the cache when fetchRenderContext changes
    // fetchRenderContext will change when any of the environment changes
    // This includes collection environment, global environment and folder environment
    renderContextPromiseCache.current = undefined;
  }, [enableCache, fetchRenderContext]);

  return {
    handleRender,
    handleGetRenderContext,
  };
};
