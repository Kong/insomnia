var request = require('request');

var options = {
  method: 'POST',
  url: 'http://mockbin.com/har',
  headers: { 'content-type': 'application/json' },
  body: {
    number: 1,
    string: 'f"oo',
    arr: [1, 2, 3],
    nested: { a: 'b' },
    arr_mix: [1, 'a', { arr_mix_nested: {} }],
    boolean: false,
  },
  json: true,
};

request(options, function(error, response, body) {
  if (error) throw new Error(error);

  console.log(body);
});
