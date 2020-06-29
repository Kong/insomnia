const { send, getBodyBuffer, initDb, modelTypes, runTests } = require('../dist');

initDb(modelTypes()).catch(err => {
  console.log('Failed to initialize DB', err);
});

global.require = require;

const exampleTestWithRequest = `
const { expect } = chai;
describe('Example', () => {
  it('should be true', async () => {
    const resp = await insomnia.send('req_wrk_ba6d41d014f34b0c9607cc4ce90b9e7723acbe44');
    expect(resp.status).to.equal(200);
  });
});
`;

async function sendInsomniaRequest(requestId) {
  const res = await send(requestId, 'env_env_91c8596946272a35b2fd5a0bab565ef4350297a8_sub');

  const headersObj = {};
  for (const h of res.headers || []) {
    const name = h.name || '';
    headersObj[name.toLowerCase()] = h.value || '';
  }

  const bodyBuffer = await getBodyBuffer(res);

  return {
    status: res.statusCode,
    statusMessage: res.statusMessage,
    data: bodyBuffer ? bodyBuffer.toString('utf8') : undefined,
    headers: headersObj,
  };
}

(async function() {
  const results = await runTests(exampleTestWithRequest, {
    sendRequest: sendInsomniaRequest,
  });
  console.log('RESULTS', JSON.stringify(results, null, 2));
})();
