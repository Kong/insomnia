var unirest = require('unirest');

var req = unirest('POST', 'http://mockbin.com/har');

var CookieJar = unirest.jar();
CookieJar.add('foo=bar', 'http://mockbin.com/har');
CookieJar.add('bar=baz', 'http://mockbin.com/har');
req.jar(CookieJar);

req.end(function(res) {
  if (res.error) throw new Error(res.error);

  console.log(res.body);
});
