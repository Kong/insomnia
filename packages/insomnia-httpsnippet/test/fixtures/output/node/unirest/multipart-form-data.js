var unirest = require("unirest");

var req = unirest("POST", "http://mockbin.com/har");

req.headers({
  "content-type": "multipart/form-data; boundary=---011000010111000001101001"
});

req.multipart([
  {
    "body": "bar"
  }
]);

req.end(function (res) {
  if (res.error) throw new Error(res.error);

  console.log(res.body);
});

