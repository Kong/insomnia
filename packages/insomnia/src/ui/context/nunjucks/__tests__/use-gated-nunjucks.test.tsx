import { describe, expect, it, jest } from '@jest/globals';
import { renderHook } from '@testing-library/react';
import React, { FC } from 'react';

import { NunjucksEnabledProvider } from '../nunjucks-enabled-context';
import { useGatedNunjucks } from '../use-gated-nunjucks';
import { useNunjucks } from '../use-nunjucks';

jest.mock('../use-nunjucks', () => {
  const funcs: ReturnType<typeof useNunjucks> = {
    handleRender: jest.fn(),
    handleGetRenderContext: jest.fn(),
  };

  return ({
    useNunjucks: () => funcs,
  });
});

describe('useGatedNunjucks', () => {
  it('should return defined functions (disableContext false, disableProp false)', () => {
    const wrapper: FC = ({ children }) => (
      <NunjucksEnabledProvider disable={false}>
        {children}
      </NunjucksEnabledProvider>
    );

    const { result } = renderHook(() => useGatedNunjucks({ disabled: false }), { wrapper });

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
        {children}
      </NunjucksEnabledProvider>
    );

    const { result } = renderHook(() => useGatedNunjucks({ disabled: disableProp }), { wrapper });

    expect(result.current.handleRender).not.toBeDefined();
    expect(result.current.handleGetRenderContext).not.toBeDefined();
  });
});
