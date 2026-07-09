import { createTV } from 'tailwind-variants';

import { twMergeConfig } from './cn';

/**
 * Single tv() instance for the whole library. It reuses the same tailwind-merge config as
 * `cn()` (see utils/cn.ts), so variant and non-variant components resolve class conflicts
 * identically. Library-internal only — components consume this, business code never imports tv.
 */
export const tv = createTV({ twMergeConfig });

/** Shared `sm/md/lg` size scale (matches the existing Button convention) for reuse across components. */
export const sizes = {
  sm: 'h-7 px-2 text-sm gap-1 rounded-sm',
  md: 'h-8 px-3 text-base gap-2 rounded-md',
  lg: 'h-9 px-4 text-lg gap-3 rounded-lg',
};

/** Shared focus-visible ring, applied to interactive elements. */
export const focusRing = 'outline-none data-focus-visible:ring-2 data-focus-visible:ring-(--hl-md)';
