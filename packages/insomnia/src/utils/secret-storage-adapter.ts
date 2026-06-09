// Imports renderer by default; esbuild node builds alias this to secret-storage-adapter.node
export { setSecret, getSecret, deleteSecret, encryptString, decryptString } from './secret-storage-adapter.renderer';
