var request = require("request");

var options = { method: 'PROPFIND', url: 'http://mockbin.com/har' };

request(options, function (error, response, body) {
  if (error) throw new Error(error);

  console.log(body);
});

