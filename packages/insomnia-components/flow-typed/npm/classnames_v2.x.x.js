// flow-typed signature: a00cf41b09af4862583460529d5cfcb9
// flow-typed version: c6154227d1/classnames_v2.x.x/flow_>=v0.104.x

type $npm$classnames$Classes =
  | string
  | { [className: string]: *, ... }
  | false
  | void
  | null;

declare module "classnames" {
  declare module.exports: (
    ...classes: Array<$npm$classnames$Classes | $npm$classnames$Classes[]>
  ) => string;
}

declare module "classnames/bind" {
  declare module.exports: $Exports<"classnames">;
}

declare module "classnames/dedupe" {
  declare module.exports: $Exports<"classnames">;
}
