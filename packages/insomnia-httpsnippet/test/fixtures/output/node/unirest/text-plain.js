var unirest = require('unirest');

var req = unirest('POST', 'http://mockbin.com/har');

req.headers({
  'content-type': 'text/plain'
});

req.send('Hello World');

req.end(function(res) {
  if (res.error) throw new Error(res.error);

  console.log(res.body);
});
