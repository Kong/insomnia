import { renderHook } from '@testing-library/react-hooks';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import { globalBeforeEach } from '../../../../__jest__/before-each';
import { reduxStateForTest } from '../../../../__jest__/redux-state-for-test';
import { withReduxStore } from '../../../../__jest__/with-redux-store';
import { RootState } from '../../../redux/modules';
import { useNunjucksEnabled } from '../nunjucks-enabled-context';
import { NunjucksProvider } from '../nunjucks-provider';
import { useNunjucksRenderFunctions } from '../nunjucks-render-function-context';

const middlewares = [thunk];
const mockStore = configureMockStore<RootState>(middlewares);

describe('NunjucksProvider', () => {
  beforeEach(globalBeforeEach);

  it('should setup NunjucksEnabledProvider', async () => {
    const store = mockStore(await reduxStateForTest());

    const { result: { error } } = renderHook(useNunjucksEnabled, { wrapper: withReduxStore(store) });
    expect(error?.message).toBe('useNunjucksEnabled must be used within a NunjucksEnabledProvider or NunjucksProvider');

    const { result: { current } } = renderHook(useNunjucksEnabled, { wrapper: withReduxStore(store, NunjucksProvider) });
    expect(current.enabled).toBe(true);
  });

  it('should setup NunjucksRenderFunctionProvider', async () => {
    const store = mockStore(await reduxStateForTest());

    const { result: { error } } = renderHook(useNunjucksRenderFunctions, { wrapper: withReduxStore(store) });
    expect(error?.message).toBe('useNunjucksRenderFunctions must be used within a NunjucksRenderFunctionProvider or NunjucksProvider');

    const { result: { current } } = renderHook(useNunjucksRenderFunctions, { wrapper: withReduxStore(store, NunjucksProvider) });
    expect(current.handleRender).toBeDefined();
    expect(current.handleGetRenderContext).toBeDefined();
  });
});
