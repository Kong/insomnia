import type { AppRuntime } from '../types';

export const prompt: AppRuntime['prompt'] = async (title, options) => {
  const { requestPromptFromRenderer } = await import('../../main/prompt-bridge');
  const value = await requestPromptFromRenderer({
    ...options,
    title,
  });
  return value ?? options?.defaultValue ?? '';
};
