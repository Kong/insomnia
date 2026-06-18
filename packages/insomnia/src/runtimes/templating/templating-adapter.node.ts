import type { RenderInputType } from '~/common/templating/types';

export async function renderTemplate({
  input,
  context,
  path,
  ignoreUndefinedEnvVariable,
}: RenderInputType): Promise<string | null> {
  const templating = await import('../../templating/template-renderer.node');
  return templating.render(input, { context, path, ignoreUndefinedEnvVariable });
}
