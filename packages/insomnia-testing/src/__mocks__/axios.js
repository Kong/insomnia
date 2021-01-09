const axios = jest.genMockFromModule('axios');

const mockResponses = {};

function key(method, url) {
  return `${method.toLowerCase()}:${url.toLowerCase()}`;
}

axios.__setResponse = (method, url, resp) => {
  mockResponses[key(method, url)] = resp;
};

axios.request = async function({ method, url, data, headers }) {
  const k = key(method, url);
  let resp = mockResponses[k];
  if (!resp) {
    throw new Error(
      `Could not find mock axios response for ${k}. Options are [${Object.keys(mockResponses).join(
        ', ',
      )}]`,
    );
  }

  if (typeof resp === 'function') {
    resp = resp({ method, url, data, headers });
  }

  return Promise.resolve(resp);
};

module.exports = axios;
