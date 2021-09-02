// @TODO We should make a PR for improving the types of httpsnippet.
declare module 'httpsnippet' {
  export interface HTTPSnippetClient {
    key: string;
    title: string;
    link: string;
    description: string;
  }

  export interface HTTPSnippetTarget {
    key: string;
    title: string;
    extname: string;
    default: string;
    clients: HTTPSnippetClient[];
  }

  class HTTPSnippet {
    constructor(data: any);
    convert(target: string, options?: any): string | false;

    convert(target: string, client?: string, options?: any): string | false;

    static addTarget(target: HTTPSnippetTarget): void;

    static addTargetClient(target: string, client: HTTPSnippetClient): void;

    static extName(target: string): string;
    static availableTargets(): HTTPSnippetTarget[];
  }

  export default HTTPSnippet;
}
