import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { renderHook } from '@testing-library/react';
import { mocked } from 'jest-mock';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { PromiseValue } from 'type-fest';

import { globalBeforeEach } from '../../../../__jest__/before-each';
import { reduxStateForTest } from '../../../../__jest__/redux-state-for-test';
import { withReduxStore } from '../../../../__jest__/with-redux-store';
import { ACTIVITY_DEBUG } from '../../../../common/constants';
import { getRenderContext, getRenderContextAncestors, render } from '../../../../common/render';
import * as models from '../../../../models';
import { RootState } from '../../../redux/modules';
import { initializeNunjucksRenderPromiseCache, useNunjucks } from '../use-nunjucks';

const renderMock = mocked(render);
const getRenderContextMock = mocked(getRenderContext);
const getRenderContextAncestorsMock = mocked(getRenderContextAncestors);

jest.mock('../../../../common/render', () => ({
  render: jest.fn(),
  getRenderContext: jest.fn(),
  getRenderContextAncestors: jest.fn(),
}));

const middlewares = [thunk];
const mockStore = configureMockStore<RootState>(middlewares);

const mockAncestors: PromiseValue<ReturnType<typeof getRenderContextAncestorsMock>> = [];
const mockContext: PromiseValue<ReturnType<typeof getRenderContextMock>> = { foo: 'bar' };

describe('useNunjucks', () => {
  beforeEach(async () => {
    await globalBeforeEach();
    getRenderContextMock.mockResolvedValue(mockContext);
    getRenderContextAncestorsMock.mockResolvedValue(mockAncestors);
    initializeNunjucksRenderPromiseCache();
  });

  describe('handleGetRenderContext', () => {

    it('should return context with keys', async () => {
      const store = mockStore(await reduxStateForTest({
        activeActivity: ACTIVITY_DEBUG,
      }));

      const { result } = renderHook(useNunjucks, { wrapper: withReduxStore(store) });

      const context = await result.current.handleGetRenderContext();

      expect(context).toStrictEqual({
        context: mockContext,
        keys: [{
          name: '_.foo',
          value: 'bar',
        }],
      });
    });

    it('should get context using the active entities', async () => {
      // Arrange
      const workspace = await models.workspace.create();
      await models.workspaceMeta.getOrCreateByParentId(workspace._id);
      const environment = await models.environment.getOrCreateForParentId(workspace._id);
      const request = await models.request.create({ parentId: workspace._id });

      await models.workspaceMeta.updateByParentId(workspace._id, {
        activeEnvironmentId: environment._id,
        activeRequestId: request._id,
      });

      const store = mockStore(await reduxStateForTest({
        activeActivity: ACTIVITY_DEBUG,
        activeWorkspaceId: workspace._id,
      }));

      // Act
      const { result } = renderHook(useNunjucks, { wrapper: withReduxStore(store) });
      await result.current.handleGetRenderContext();

      // Assert
      expect(getRenderContextAncestorsMock).toBeCalledWith(request);
      expect(getRenderContextMock).toBeCalledWith({
        request,
        environmentId: environment._id,
        ancestors: mockAncestors,
      });
    });

    it('should get context using the active entities - no request', async () => {
      // Arrange
      const workspace = await models.workspace.create();
      await models.workspaceMeta.getOrCreateByParentId(workspace._id);
      const environment = await models.environment.getOrCreateForParentId(workspace._id);

      await models.workspaceMeta.updateByParentId(workspace._id, {
        activeEnvironmentId: environment._id,
      });

      const store = mockStore(await reduxStateForTest({
        activeActivity: ACTIVITY_DEBUG,
        activeWorkspaceId: workspace._id,
      }));

      // Act
      const { result } = renderHook(useNunjucks, { wrapper: withReduxStore(store) });
      await result.current.handleGetRenderContext();

      // Assert
      expect(getRenderContextAncestorsMock).toBeCalledWith(workspace);
      expect(getRenderContextMock).toBeCalledWith({
        request: undefined,
        environmentId: environment._id,
        ancestors: mockAncestors,
      });
    });
  });

  describe('handleRender', () => {
    it('should render and get context once', async () => {
      // Arrange
      const store = mockStore(await reduxStateForTest());

      // Act
      const { result } = renderHook(useNunjucks, { wrapper: withReduxStore(store) });
      await result.current.handleRender('abc');

      // Assert
      expect(getRenderContextMock).toHaveBeenCalledTimes(1);
      expect(renderMock).toHaveBeenCalledTimes(1);
    });

    it('should render and get context twice because there is no caching', async () => {
      // Arrange
      const store = mockStore(await reduxStateForTest());

      // Act
      const { result } = renderHook(useNunjucks, { wrapper: withReduxStore(store) });
      await result.current.handleRender('abc');
      await result.current.handleRender('def');

      // Assert
      expect(getRenderContextMock).toHaveBeenCalledTimes(2);
      expect(renderMock).toHaveBeenCalledTimes(2);
    });

    it('should render and get context once because there is a cache', async () => {
      // Arrange
      const store = mockStore(await reduxStateForTest());

      // Act
      const { result } = renderHook(useNunjucks, { wrapper: withReduxStore(store) });
      const cacheKey = 'cache';

      await result.current.handleRender('abc', cacheKey);
      await result.current.handleRender('def', cacheKey);

      // Assert
      expect(getRenderContextMock).toHaveBeenCalledTimes(1);
      expect(renderMock).toHaveBeenCalledTimes(2);
    });

    it('should render and get context twice because there are different cache keys', async () => {
      // Arrange
      const store = mockStore(await reduxStateForTest());

      // Act
      const { result } = renderHook(useNunjucks, { wrapper: withReduxStore(store) });
      const cacheKeyOne = 'cache-1';
      const cacheKeyTwo = 'cache-2';

      await result.current.handleRender('abc', cacheKeyOne);
      await result.current.handleRender('def', cacheKeyTwo);
      await result.current.handleRender('ghi', cacheKeyOne);
      await result.current.handleRender('jkl', cacheKeyTwo);

      // Assert
      expect(getRenderContextMock).toHaveBeenCalledTimes(2);
      expect(renderMock).toHaveBeenCalledTimes(4);
    });

    it('should not change the cache during re-renders of the hook', async () => {
      // Arrange
      const store = mockStore(await reduxStateForTest());

      // Act
      const { result, rerender } = renderHook(useNunjucks, { wrapper: withReduxStore(store) });
      const cacheKeyOne = 'cache-1';
      const cacheKeyTwo = 'cache-2';

      await result.current.handleRender('abc', cacheKeyOne);
      rerender();
      await result.current.handleRender('def', cacheKeyTwo);
      rerender();
      await result.current.handleRender('ghi', cacheKeyOne);
      rerender();
      await result.current.handleRender('jkl', cacheKeyTwo);

      // Assert
      expect(getRenderContextMock).toHaveBeenCalledTimes(2);
      expect(renderMock).toHaveBeenCalledTimes(4);
    });

    it('should not change the cache during multiple renders of the hook', async () => {
      // Arrange
      const store = mockStore(await reduxStateForTest());

      // Act
      const cacheKeyOne = 'cache-1';
      const cacheKeyTwo = 'cache-2';

      await renderHook(useNunjucks, { wrapper: withReduxStore(store) }).result.current.handleRender('abc', cacheKeyOne);
      await renderHook(useNunjucks, { wrapper: withReduxStore(store) }).result.current.handleRender('def', cacheKeyTwo);
      await renderHook(useNunjucks, { wrapper: withReduxStore(store) }).result.current.handleRender('ghi', cacheKeyOne);
      await renderHook(useNunjucks, { wrapper: withReduxStore(store) }).result.current.handleRender('jkl', cacheKeyTwo);

      // Assert
      expect(getRenderContextMock).toHaveBeenCalledTimes(2);
      expect(renderMock).toHaveBeenCalledTimes(4);
    });
  });
});
