import { database as db } from '../common/database';
import type { BaseModel } from './index';

export const name = 'LLM Configuration';

export const type = 'LLMConfiguration';

export const prefix = 'llm';

export const canDuplicate = true;

export const canSync = true;

interface BaseLLMConfiguration {
  backend: 'gguf' | 'claude' | 'openai';
  model: string;
  current: string;
  apiKey?: string;
  temperature: number | null;
  topP: number | null;
  topK: number | null;
  seed: boolean | null;
  repeatPenalty: number | null;
}

export type LLMConfiguration = BaseModel & BaseLLMConfiguration;

export const isLLMConfiguration = (model: Pick<BaseModel, 'type'>): model is LLMConfiguration => model.type === type;

export function init(): BaseLLMConfiguration {
  return {
    backend: 'gguf',
    model: '',
    apiKey: '',
    current: 'no',
    temperature: null,
    topP: null,
    topK: null,
    seed: null,
    repeatPenalty: null,
  };
}

export function migrate(doc: LLMConfiguration) {
  if (doc.temperature === undefined) doc.temperature = null;
  if (doc.topP === undefined) doc.topP = null;
  if (doc.topK === undefined) doc.topK = null;
  if (doc.seed === undefined) doc.seed = null;
  if (doc.repeatPenalty === undefined) doc.repeatPenalty = null;

  return doc;
}

export function getCurrent() {
  return db.findOne<LLMConfiguration>(type, { current: 'yes' });
}

export async function setCurrent(obj: LLMConfiguration) {
  const current = await getCurrent();
  if (current) {
    await update(current, { current: 'no' });
  }
  return db.docUpdate<LLMConfiguration>(obj, { current: 'yes' });
}

export function create(patch: Partial<LLMConfiguration> = {}) {
  return db.docCreate<LLMConfiguration>(type, patch);
}

export function update(obj: LLMConfiguration, patch: Partial<LLMConfiguration>) {
  return db.docUpdate<LLMConfiguration>(obj, patch);
}

export function getByBackend(backend: string) {
  return db.findOne<LLMConfiguration>(type, { backend });
}

export function remove(obj: LLMConfiguration) {
  return db.remove(obj);
}

export function all() {
  return db.find<LLMConfiguration>(type);
}
