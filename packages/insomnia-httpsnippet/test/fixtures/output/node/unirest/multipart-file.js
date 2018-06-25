var fs = require('fs');
var unirest = require('unirest');

var req = unirest('POST', 'http://mockbin.com/har');

req.headers({
  'content-type': 'multipart/form-data; boundary=---011000010111000001101001'
});

req.multipart([
  {
    body: fs.createReadStream('test/fixtures/files/hello.txt'),
    'content-type': 'text/plain'
  }
]);

req.end(function(res) {
  if (res.error) throw new Error(res.error);

  console.log(res.body);
});
