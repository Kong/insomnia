const axios = jest.genMockFromModule('axios');

const mockResponses = {};

function key(method, url) {
  return `${method.toLowerCase()}:${url.toLowerCase()}`;
}

axios.__setResponse = (method, url, resp) => {
  mockResponses[key(method, url)] = resp;
};

axios.request = async function({ method, url }) {
  const k = key(method, url);
  const resp = mockResponses[k];
  if (!resp) {
    throw new Error(
      `Could not find mock axios response for ${k}. Options are [${Object.keys(mockResponses).join(
        ', ',
      )}]`,
    );
  }

  return Promise.resolve(resp);
};

module.exports = axios;
