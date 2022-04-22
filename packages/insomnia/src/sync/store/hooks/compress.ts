import zlib from 'zlib';

import type { HookFn } from '../index';

const read: HookFn = async function read(extension: string, value: Buffer) {
  if (extension) {
    return value;
  }

  return new Promise((resolve, reject) => {
    zlib.gunzip(value, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
};

const write: HookFn = async function read(extension: string, value: Buffer) {
  if (extension) {
    return value;
  }

  return new Promise((resolve, reject) => {
    zlib.gzip(value, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
};

export default {
  read,
  write,
};
