// Mock this so our tests don't have to load node-libcurl, which will have been compiled for
// electron on CI probably
export async function getSendRequestCallback(environmentId, memDB) {
  return async function sendRequest(requestId) {
    return {
      status: 200,
      statusMessage: 'OK',
      data: '{}',
      headers: {
        'content-type': 'application/json',
      },
    };
  };
}
