import { invariant } from '../../utils/invariant';

const createHash = ({ value, algorithm, encoding }) => {
  return window.bridge.crypto.createHash(algorithm || 'md5')
    .update(value || '', 'utf8')
    .digest(encoding || 'hex');
};
const writeFile = ({ path, contents }) => {
  return window.bridge.fs.writeFile(path, contents);
};
const runPreRequestScript = ({ script, context }) => {
  return window.bridge.runPreRequestScript(script, context);
};
const work = {
  createHash,
  writeFile,
  runPreRequestScript,
};
window.bridge.on('new-client', async event => {
  const [port] = event.ports;
  console.log('opened port to insomnia renderer');
  port.onmessage = async event => {
    try {
      invariant(event.data.type, 'Missing work type');
      const workType: 'createHash' | 'writeFile' = event.data.type;
      invariant(work[workType], `Unknown work type ${workType}`);
      const result = await work[workType](event.data);
      console.log('got', { input: event.data, result });
      port.postMessage(result);
    } catch (err) {
      console.error('error', err);
      port.postMessage({ error: err.message });
    }
  };
});
