// JS value and TS type to be imported by insomnia-submodule
export interface PlusArgs {
  a: number;
  b: number;
}

export function plus(plusArgs: PlusArgs): number {
  return plusArgs.a + plusArgs.b;
}
