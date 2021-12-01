import { renderHook } from '@testing-library/react-hooks';
import React from 'react';
import { FC } from 'react';

import { NunjucksEnabledProvider } from '../nunjucks-enabled-context';
import { NunjucksRenderFunctionProvider } from '../nunjucks-render-function-context';
import { useGatedNunjucksRenderFunctions } from '../use-gated-nunjucks-render-functions';
import { useRenderFunctions } from '../use-render-functions';

jest.mock('../use-render-functions', () => {
  const renderFunctions: ReturnType<typeof useRenderFunctions> = {
    handleRender: jest.fn(),
    handleGetRenderContext: jest.fn(),
  };

  return ({
    useRenderFunctions: () => renderFunctions,
  });
});

describe('useGatedNunjucksRenderFunctions', () => {
  it('should return defined functions (disableContext false, disableProp false)', () => {
    const wrapper: FC = ({ children }) => (
      <NunjucksEnabledProvider disable={false}>
        <NunjucksRenderFunctionProvider>
          {children}
        </NunjucksRenderFunctionProvider>
      </NunjucksEnabledProvider>
    );

    const { result } = renderHook(() => useGatedNunjucksRenderFunctions({ disabled: false }), { wrapper });

    expect(result.current.handleRender).toBeDefined();
    expect(result.current.handleGetRenderContext).toBeDefined();
  });

  it.each([
    [true, false],
    [false, true],
    [true, true],
  ])('should return undefined functions (disableContext %s, disableProp %s)', (disableContext: boolean, disableProp: boolean) => {
    const wrapper: FC = ({ children }) => (
      <NunjucksEnabledProvider disable={disableContext}>
        <NunjucksRenderFunctionProvider>
          {children}
        </NunjucksRenderFunctionProvider>
      </NunjucksEnabledProvider>
    );

    const { result } = renderHook(() => useGatedNunjucksRenderFunctions({ disabled: disableProp }), { wrapper });

    expect(result.current.handleRender).not.toBeDefined();
    expect(result.current.handleGetRenderContext).not.toBeDefined();
  });
});
