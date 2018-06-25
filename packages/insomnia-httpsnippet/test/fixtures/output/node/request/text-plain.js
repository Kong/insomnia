var request = require('request');

var options = {
  method: 'POST',
  url: 'http://mockbin.com/har',
  headers: { 'content-type': 'text/plain' },
  body: 'Hello World'
};

request(options, function(error, response, body) {
  if (error) throw new Error(error);

  console.log(body);
});
