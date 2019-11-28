// @flow

declare module 'codemirror' {
  declare class TextMarker {
    __isFold: boolean;
    clear(): void;
    find(): { from: Pos, to: Pos };
  }
  declare class Doc {
    markText(
      from: Pos,
      to: Pos,
      options?: {|
        inclusiveLeft?: boolean,
        className?: string,
        color?: string,
      |},
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
    setValue(string): void;
    hasFocus(): boolean;
    indexFromPos(pos: Pos): number;
    getAllMarks(): Array<TextMarker>;
  }
}
