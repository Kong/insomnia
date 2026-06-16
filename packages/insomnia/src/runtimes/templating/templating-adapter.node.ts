import type { RenderInputType } from '~/common/templating/types';

export async function renderTemplate({
  input,
  context,
  path,
  ignoreUndefinedEnvVariable,
}: RenderInputType): Promise<string | null> {
  const templating = await import('../../templating/index');
  return templating.render(input, { context, path, ignoreUndefinedEnvVariable });
}
