// universal (browser + node) string hashing utility
// uses Web Crypto API under the hood (node >= 15, modern browsers)
export const hashStringToHex = async (str: string, algorithm: AlgorithmIdentifier = 'SHA-256') => {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest(algorithm, data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
};
export const hashStringToBuffer = async (str: string, algorithm: AlgorithmIdentifier = 'SHA-256') => {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest(algorithm, data);
  return Buffer.from(hashBuffer);
};
