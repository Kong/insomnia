import electron from 'electron';
const isTest = process.env.NODE_ENV === 'test';
// const isNodeProcess = !process.versions.electron
const isRenderProcess = process.type === 'renderer';
const shouldOverrideRemote = isRenderProcess && !isTest;

export default shouldOverrideRemote ? { ...electron, remote: require('@electron/remote') } : electron;
