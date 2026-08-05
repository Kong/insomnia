import type { Context, Liquid } from 'liquidjs';

import type { NunjucksParsedTagArg } from './types';

export async function resolveArg(arg: NunjucksParsedTagArg, ctx: Context, liquid: Liquid): Promise<any> {
  if (arg.type === 'variable' || arg.type === 'expression') {
    return liquid.evalValue(arg.value as string, ctx);
  }
  return arg.value;
}
