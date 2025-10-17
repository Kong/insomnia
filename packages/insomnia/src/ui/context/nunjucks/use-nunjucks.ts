import { memoize } from '@formatjs/fast-memoize';

import { getRenderContext, render } from '~/common/render';
import type { RequestGroup } from '~/models/request-group';
import { useWorkspaceLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { useRequestLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import { useRequestGroupLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.$requestGroupId';
import { NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME } from '~/templating';
import type { BaseRenderContext, RenderContextOptions } from '~/templating/types';
import { getKeys } from '~/templating/utils';
let getRenderContextPromiseCache: any = {};

export interface UseNunjucksOptions {
  renderContext: Pick<Partial<RenderContextOptions>, 'purpose' | 'extraInfo'>;
}
export const initializeNunjucksRenderPromiseCache = () => {
  getRenderContextPromiseCache = {};
};

initializeNunjucksRenderPromiseCache();

const getMemoizedRenderContext = memoize(
  async ({
    requestData,
    workspaceData,
    options,
  }: {
    requestData: ReturnType<typeof useRequestLoaderData>;
    workspaceData: ReturnType<typeof useWorkspaceLoaderData>;
    activeRequestGroup?: RequestGroup;
    options?: { renderContext: RenderContextOptions };
  }): Promise<BaseRenderContext> =>
    await getRenderContext({
      request: requestData?.activeRequest || undefined,
      environment: workspaceData?.activeEnvironment._id,
      ...options?.renderContext,
    }),
);

/**
 * Access to functions useful for Nunjucks rendering
 */
export const useNunjucks = (options?: UseNunjucksOptions) => {
  // for all types of requests
  const requestData = useRequestLoaderData();
  // for request group (folder)
  const { activeRequestGroup } = useRequestGroupLoaderData() || {};
  const workspaceData = useWorkspaceLoaderData();

  return {
    handleRender: async (input: string) => {
      const context = await getMemoizedRenderContext({
        requestData,
        workspaceData,
        activeRequestGroup,
        options,
      });
      return render(input, context);
    },
    handleGetRenderContext: async () => {
      const context = await getMemoizedRenderContext({
        requestData,
        workspaceData,
        activeRequestGroup,
        options,
      });
      const keys = getKeys(context, NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME);
      return { context, keys };
    },
  };
};
