export const setSecret = (key: string, secret: string) => window.main.secretStorage.setSecret(key, secret);
export const getSecret = (key: string) => window.main.secretStorage.getSecret(key);
export const deleteSecret = (key: string) => window.main.secretStorage.deleteSecret(key);
export const encryptString = (raw: string) => window.main.secretStorage.encryptString(raw);
export const decryptString = (cipherText: string) => window.main.secretStorage.decryptString(cipherText);
