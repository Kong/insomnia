import { describe, expect, it } from '@jest/globals';
import { renderHook } from '@testing-library/react';

import { NunjucksEnabledProvider, useNunjucksEnabled } from '../nunjucks-enabled-context';

describe('NunjucksEnabledProvider', () => {
  it('should initialize as enabled', () => {
    const { result } = renderHook(() => useNunjucksEnabled(), { wrapper: NunjucksEnabledProvider });

    expect(result.current.enabled).toBe(true);
  });
});
