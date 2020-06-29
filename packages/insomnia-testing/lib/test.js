const { sendInsomniaRequest } = require('../dist');

global.require = require;

(async function() {
  console.log('SENDING REQUEST');
  const response = await sendInsomniaRequest('req_wrk_ba6d41d014f34b0c9607cc4ce90b9e7723acbe44');
  console.log('RESPONSE', response);
})();
