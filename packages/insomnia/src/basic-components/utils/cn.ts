import { extendTailwindMerge } from 'tailwind-merge';

/**
 * The library's single source of truth for tailwind-merge behavior.
 * Both `cn()` (non-variant components) and the shared `tv` instance (utils/variants.ts)
 * consume this config, so class-conflict resolution stays consistent library-wide and any
 * future customization (e.g. registering custom class groups) is a one-place change.
 *
 * Empty today: tailwind-merge v3 already resolves Tailwind v4 syntax (`bg-(--var)`, `size-*`, …)
 * out of the box, so no custom groups are needed yet.
 */
export const twMergeConfig = {};

/** Merge conditional class names, resolving Tailwind utility conflicts via the shared config. */
export const cn = extendTailwindMerge(twMergeConfig);
