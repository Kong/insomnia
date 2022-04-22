import { renderHook } from '@testing-library/react-hooks';

import { NunjucksEnabledProvider, useNunjucksEnabled } from '../nunjucks-enabled-context';

describe('NunjucksEnabledProvider', () => {
  it('should initialize as enabled', () => {
    const { result } = renderHook(() => useNunjucksEnabled(), { wrapper: NunjucksEnabledProvider });

    expect(result.current.enabled).toBe(true);
  });

  it('should update the hook result if prop changes', () => {
    const { rerender, result } = renderHook(() => useNunjucksEnabled(), { wrapper: NunjucksEnabledProvider, initialProps: { disable: false } });

    expect(result.current.enabled).toBe(true);

    rerender({ disable: true });

    expect(result.current.enabled).toBe(false);
  });
});
