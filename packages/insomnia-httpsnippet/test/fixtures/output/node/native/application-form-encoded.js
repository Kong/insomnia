var qs = require('querystring');
var http = require('http');

var options = {
  method: 'POST',
  hostname: 'mockbin.com',
  port: null,
  path: '/har',
  headers: {
    'content-type': 'application/x-www-form-urlencoded',
  },
};

var req = http.request(options, function(res) {
  var chunks = [];

  res.on('data', function(chunk) {
    chunks.push(chunk);
  });

  res.on('end', function() {
    var body = Buffer.concat(chunks);
    console.log(body.toString());
  });
});

req.write(qs.stringify({ foo: 'bar', hello: 'world' }));
req.end();
