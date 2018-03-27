var http = require("http");

var options = {
  "method": "POST",
  "hostname": "mockbin.com",
  "port": null,
  "path": "/har",
  "headers": {
    "cookie": "foo=bar; bar=baz"
  }
};

var req = http.request(options, function (res) {
  var chunks = [];

  res.on("data", function (chunk) {
    chunks.push(chunk);
  });

  res.on("end", function () {
    var body = Buffer.concat(chunks);
    console.log(body.toString());
  });
});

req.end();
