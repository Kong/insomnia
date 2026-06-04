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
