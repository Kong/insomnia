const BASE64_CHUNK_SIZE = 0x80_00;

export function utf8BytesFromString(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export function utf8ByteLength(value: string): number {
  return utf8BytesFromString(value).length;
}

export function utf8StringFromBytes(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

export function latin1BytesFromString(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i++) {
    // eslint-disable-next-line unicorn/prefer-code-point -- charCodeAt for latin1 for accuracy
    bytes[i] = value.charCodeAt(i) & 0xff;
  }
  return bytes;
}

export function utf8ToBase64(value: string): string {
  return bytesToBase64(utf8BytesFromString(value));
}

export function base64ToUtf8(base64: string): string {
  return utf8StringFromBytes(Uint8Array.from(atob(base64), c => c.codePointAt(0) ?? 0));
}

export function bytesToBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE) {
    chunks.push(String.fromCodePoint(...bytes.subarray(offset, offset + BASE64_CHUNK_SIZE)));
  }
  return btoa(chunks.join(''));
}

export function bodyBufferToUtf8(body: Uint8Array | string | null | undefined): string {
  if (body == null) {
    return '';
  }
  if (typeof body === 'string') {
    return body;
  }
  return utf8StringFromBytes(body);
}
