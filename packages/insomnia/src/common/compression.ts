import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';

const bytesToBase64 = (bytes: Uint8Array) => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }

  return btoa(binary);
};

const base64ToBytes = (input: string) => {
  if (typeof Buffer !== 'undefined') {
    return Uint8Array.from(Buffer.from(input, 'base64'));
  }

  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.codePointAt(index)!;
  }

  return bytes;
};

export function compressObject(obj: any) {
  return bytesToBase64(gzipSync(strToU8(JSON.stringify(obj))));
}

export function decompressObject<ObjectType>(input: string | null): ObjectType | null {
  if (typeof input !== 'string') {
    return null;
  }

  return JSON.parse(strFromU8(gunzipSync(base64ToBytes(input)))) as ObjectType;
}