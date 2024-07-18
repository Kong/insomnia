declare module 'yaml-source-map' {
  interface Location {
    filename?: string;
    start: {
      line: number;
      col: number;
    };
    end: {
      line: number;
      col: number;
    };
  }

  export default class YAMLSourceMap {
    constructor();
    index(doc: YAML.Document.Parsed): object;
    lookup(path: string[], document: object): Location | undefined;
  }
}
