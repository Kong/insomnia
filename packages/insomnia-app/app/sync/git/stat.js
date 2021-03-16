// @flow

type StatObj = {
  type: 'file' | 'dir' | 'symlink',
  mode: number,
  size: number,
  ino: number,
  mtimeMs: number,
  ctimeMs?: number,
};

export default class Stat {
  type: 'file' | 'dir' | 'symlink';
  mode: number;
  size: number;
  ino: number;
  mtimeMs: number;
  ctimeMs: number;
  uid: 1;
  gid: 1;
  dev: 1;

  constructor(stats: StatObj) {
    this.type = stats.type;
    this.mode = stats.mode;
    this.size = stats.size;
    this.ino = stats.ino;
    this.mtimeMs = stats.mtimeMs;
    this.ctimeMs = stats.ctimeMs || stats.mtimeMs;
    this.uid = 1;
    this.gid = 1;
    this.dev = 1;
  }

  isFile() {
    return this.type === 'file';
  }

  isDirectory() {
    return this.type === 'dir';
  }

  isSymbolicLink() {
    return this.type === 'symlink';
  }
}
