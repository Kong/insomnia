var request = require('request');

var jar = request.jar();
jar.setCookie(request.cookie('foo=bar'), 'http://mockbin.com/har');
jar.setCookie(request.cookie('bar=baz'), 'http://mockbin.com/har');

var options = { method: 'POST', url: 'http://mockbin.com/har', jar: 'JAR' };

request(options, function(error, response, body) {
  if (error) throw new Error(error);

  console.log(body);
});
