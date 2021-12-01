import { renderHook } from '@testing-library/react-hooks';
import { mocked } from 'ts-jest/utils';

import { globalBeforeEach } from '../../../../__jest__/before-each';
import { NunjucksRenderFunctionProvider, useNunjucksRenderFunctions } from '../nunjucks-render-function-context';
import { useRenderFunctions } from '../use-render-functions';

jest.mock('../use-render-functions', () => {
  const renderFunctions: ReturnType<typeof useRenderFunctions> = {
    handleRender: jest.fn().mockResolvedValue(true),
    handleGetRenderContext: jest.fn().mockResolvedValue(true),
  };

  return ({
    useRenderFunctions: () => renderFunctions,
  });
});

describe('NunjucksRenderFunctionProvider', () => {
  beforeEach(globalBeforeEach);

  it('should initialize with render functions generated from useRenderFunctions()', async () => {
    const { result } = renderHook(useNunjucksRenderFunctions, { wrapper: NunjucksRenderFunctionProvider });

    // Invoke the returned render functions
    await result.current.handleGetRenderContext();
    await result.current.handleRender({});

    // Ensure that the (mocked) render functions created by useRenderFunctions() were invoked
    const { handleRender, handleGetRenderContext } = mocked(useRenderFunctions());

    expect(handleRender).toHaveBeenCalled();
    expect(handleGetRenderContext).toHaveBeenCalled();
  });
});
