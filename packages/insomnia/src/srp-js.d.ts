declare module 'srp-js' {
  interface Params {
    N_length_bits: number;
    N: BigInteger;
    g: BigInteger;
    hash: string;
  }

  export const params: {
    1024: Params;
    1536: Params;
    2048: Params;
    3072: Params;
    4096: Params;
    6244: Params;
    8192: Params;
  };

  export class Client {
    constructor(params: Params, salt_buf: Buffer, identity_buf: Buffer, password_buf: Buffer, secret1_buf: Buffer);

    computeA(): Buffer;

    setB(B_buf: Buffer): void;

    computeM1(): Buffer;

    checkM2(serverM2_buf: Buffer): void;

    computeK(): Buffer;
  }

  export function computeVerifier(params: Params, salt: Buffer, I: Buffer, P: Buffer): Buffer;

  export function genKey(cb: (err: Error | undefined, res: Buffer) => void): void;
}
