import type { RenderInputType } from './types';

export async function renderTemplate(input: RenderInputType): Promise<string | null> {
  const { renderInWorker } = await import('../ui/worker/templating-handler');
  return renderInWorker(input);
}
