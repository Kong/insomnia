import { createTV } from 'tailwind-variants';

import { twMergeConfig } from './cls';

/**
 * Single tv() instance for the whole library. It reuses the same tailwind-merge config as
 * `cls()` (see utils/cls.ts), so variant and non-variant components resolve class conflicts
 * identically. Library-internal only — components consume this, business code never imports tv.
 */
export const tv = createTV({ twMergeConfig });

// Cross-component variant fragments (size/color/state scales) will be added here in M1, once real
// components (Button, IconButton, Input, …) reveal which class subsets are genuinely shared.
// Defining them before a second consumer exists risks encoding a button-shaped guess that other
// components can't reuse — see the plan's "validate against real usage" principle (§8).
