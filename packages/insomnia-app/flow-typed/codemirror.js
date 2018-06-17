declare module 'codemirror' {
  declare type Pos = {
    ch: number,
    line: number,
    sticky: string,
    xRel: number,
  }
  declare class CodeMirror {
    getCursor(): Pos,
    getValue(): string,
    indexFromPos(pos: Pos): number,
  }
}
