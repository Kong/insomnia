declare module 'hkdf' {
  export default class HKDF {
    constructor(hashAlg: string, salt: string, ikm: string);

    derive(info: string, length: number, cb: (buffer: Buffer) => void): void;
  }
}
