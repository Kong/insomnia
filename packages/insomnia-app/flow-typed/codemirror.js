// @flow

declare module 'codemirror' {
  declare class TextMarker {
    clear(): void;
  }
  declare class Doc {
    markText(
      from: { line: number, ch: number },
      to: { line: number, ch: number },
      options?: {|
        inclusiveLeft?: boolean,
        className?: string,
        color?: string
      |}
    ): TextMarker;
  }
  declare class Pos {
    ch: number;
    line: number;
    sticky: string;
    xRel: number;
  }
  declare class CodeMirror {
    doc: Doc;
    getCursor(): Pos;
    getValue(): string;
    hasFocus(): boolean;
    indexFromPos(pos: Pos): number;
  }
}
