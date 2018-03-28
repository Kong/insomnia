var unirest = require("unirest");

var req = unirest("GET", "http://mockbin.com/har");

req.headers({
  "x-foo": "Bar",
  "accept": "application/json"
});


req.end(function (res) {
  if (res.error) throw new Error(res.error);

  console.log(res.body);
});

