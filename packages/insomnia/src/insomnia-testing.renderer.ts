// Renderer-safe subset of insomnia-testing. Excludes Node.js-only modules (run.ts, generate-to-file.ts).
export { generate } from '../../insomnia-testing/src/generate/generate';
export type { Test, TestSuite } from '../../insomnia-testing/src/generate/generate';
export type { TestResults } from '../../insomnia-testing/src/run/entities';
