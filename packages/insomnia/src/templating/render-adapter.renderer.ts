import { renderInWorker } from '../ui/worker/templating-handler';
import type { RenderInputType } from './types';

export function renderTemplate(input: RenderInputType): Promise<string> {
  return renderInWorker(input);
}
