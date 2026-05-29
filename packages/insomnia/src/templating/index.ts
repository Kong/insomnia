import type * as nodeTemplating from './node';
import * as workerTemplating from './worker';

type RenderFn = typeof workerTemplating.render;
type TemplatingModule = typeof nodeTemplating;

let nodeTemplatingPromise: Promise<TemplatingModule> | null = null;

function shouldUseWorkerTemplating() {
  return (
    (process.type === 'renderer' || process.type === 'worker') &&
    globalThis.window !== undefined &&
    globalThis.window.main !== undefined
  );
}

function hasNunjucksSyntax(input: string) {
  const hasNunjucksInterpolationSymbols = input.includes('{{') && input.includes('}}');
  const hasNunjucksCustomTagSymbols = input.includes('{%') && input.includes('%}');
  const hasNunjucksCommentSymbols = input.includes('{#') && input.includes('#}');
  return hasNunjucksInterpolationSymbols || hasNunjucksCustomTagSymbols || hasNunjucksCommentSymbols;
}

function getNodeTemplatingModule() {
  if (!nodeTemplatingPromise) {
    nodeTemplatingPromise = import('./node') as Promise<TemplatingModule>;
  }

  return nodeTemplatingPromise;
}

function getTemplatingModule(): typeof workerTemplating | Promise<TemplatingModule> {
  if (shouldUseWorkerTemplating()) {
    return workerTemplating;
  }

  return getNodeTemplatingModule();
}

export const NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME = workerTemplating.NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME;

export const render: RenderFn = (...args) => {
  const templatingModule = getTemplatingModule();
  if ('render' in templatingModule) {
    return templatingModule.render(...args);
  }

  const [input] = args;
  if (!hasNunjucksSyntax(input)) {
    return input;
  }

  return templatingModule.then(module => module.render(...args));
};

export function reload() {
  const templatingModule = getTemplatingModule();
  if ('reload' in templatingModule) {
    return templatingModule.reload();
  }

  return templatingModule.then(module => module.reload());
}

export async function getTagDefinitions() {
  const templatingModule = getTemplatingModule();
  if ('getTagDefinitions' in templatingModule) {
    return templatingModule.getTagDefinitions();
  }

  return templatingModule.then(module => module.getTagDefinitions());
}
