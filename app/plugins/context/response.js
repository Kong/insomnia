export function init (plugin, response, bodyBuffer = null) {
  if (!response) {
    throw new Error('contexts.response initialized without response');
  }

  return {
    response: {
      // TODO: Make this work. Right now it doesn't because _id is
      // not generated in network.js
      // getId () {
      //   return response.parentId;
      // },
      getRequestId () {
        return response.parentId;
      },
      getStatusCode () {
        return response.statusCode;
      },
      getStatusMessage () {
        return response.statusMessage;
      },
      getBytesRead () {
        return response.bytesRead;
      },
      getTime () {
        return response.elapsedTime;
      },
      getBody () {
        return bodyBuffer;
      }
    }
  };
}
