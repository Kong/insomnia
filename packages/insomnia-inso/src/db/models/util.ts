import { InsoError } from '../../errors';
import type { BaseModel } from './types';

export const matchIdIsh = ({ _id }: BaseModel, identifier: string) =>
  _id.startsWith(identifier);

export const generateIdIsh = ({ _id }: BaseModel, length = 10) =>
  _id.substr(0, length);

function indent(level: number, code: string, tab = '  |'): string {
  if (!level || level < 0) {
    return code;
  }

  const prefix = new Array(level + 1).join(tab);
  return `${prefix} ${code}`;
}

export const getDbChoice = (
  idIsh: string,
  message: string,
  config: {
        indent?: number;
        hint?: string;
    } = {},
) => ({
  name: idIsh,
  message: indent(config.indent || 0, message),
  value: `${message} - ${idIsh}`,
  hint: config.hint || `${idIsh}`,
});

export const ensureSingleOrNone = <T>(
  items: T[],
  entity: string,
): T | null | undefined => {
  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 0) {
    return null;
  }

  throw new InsoError(
    `Expected single or no ${entity} in the data store, but found multiple (${items.length}).`,
  );
};
export const ensureSingle = <T>(items: T[], entity: string): T => {
  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 0) {
    throw new InsoError(
      `Expected single ${entity} in the data store, but found none.`,
    );
  }

  throw new InsoError(
    `Expected single ${entity} in the data store, but found multiple (${items.length}).`,
  );
};
