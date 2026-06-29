import type { BaseModel } from './base-types';

export const name = 'ProjectLintRuleset';

export const type = 'ProjectLintRuleset';

export const prefix = 'plr';

export const canDuplicate = false;

export const canSync = true;

export interface BaseProjectLintRuleset {
  rulesetContent: string;
}

export type ProjectLintRuleset = BaseModel & BaseProjectLintRuleset;

export const isProjectLintRuleset = (model: Pick<BaseModel, 'type'>): model is ProjectLintRuleset =>
  model.type === type;

export function init(): BaseProjectLintRuleset {
  return {
    rulesetContent: '',
  };
}
