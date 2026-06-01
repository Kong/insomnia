import type { RenderInputType } from './types';

export async function renderTemplate({ input, context, path, ignoreUndefinedEnvVariable }: RenderInputType): Promise<string | null> {
  const templating = await import('./index');
  return templating.render(input, { context, path, ignoreUndefinedEnvVariable });
}
