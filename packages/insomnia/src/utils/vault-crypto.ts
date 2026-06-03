export const encryptSecretValue = async (rawValue: string, symmetricKey: JsonWebKey): Promise<string> => {
  if (typeof symmetricKey !== 'object' || Object.keys(symmetricKey).length === 0) {
    return rawValue;
  }
  try {
    return await window.main.vault.encryptSecretValue(rawValue, symmetricKey);
  } catch {
    return rawValue;
  }
};

export const decryptSecretValue = async (encryptedValue: string, symmetricKey: JsonWebKey): Promise<string> => {
  if (typeof symmetricKey !== 'object' || Object.keys(symmetricKey).length === 0) {
    return encryptedValue;
  }
  try {
    return await window.main.vault.decryptSecretValue(encryptedValue, symmetricKey);
  } catch {
    return encryptedValue;
  }
};
