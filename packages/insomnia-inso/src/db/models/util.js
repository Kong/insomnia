// @flow
import type { BaseModel } from './types';

export const matchIdIsh = ({ _id }: BaseModel, identifier: string) => _id.startsWith(identifier);
export const generateIdIsh = ({ _id }: BaseModel, length: number = 10) => _id.substr(0, length);

function indent(level: number, code: string, tab: string = '  |'): string {
  if (!level || level < 0) {
    return code;
  }

  const prefix = new Array(level + 1).join(tab);
  return `${prefix} ${code}`;
}

export const getDbChoice = (
  idIsh: string,
  message: string,
  config: { indent?: number, hint?: string } = {},
) => ({
  name: idIsh,
  message: indent(config.indent || 0, message),
  value: `${message} - ${idIsh}`,
  hint: config.hint || `${idIsh}`,
});
