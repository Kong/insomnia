declare module 'git-http-backend' {
  import type { Duplex } from 'node:stream';

  interface GitService {
    type: string;
    cmd: string;
    args: string[];
    createStream: () => Duplex;
  }

  function backend(url: string, callback: (err: Error | null, service: GitService) => void): Duplex;

  export default backend;
}
