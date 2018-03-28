var request = require("request");

var options = { method: 'POST',
  url: 'http://mockbin.com/har',
  headers: { 'content-type': 'multipart/form-data; boundary=---011000010111000001101001' },
  formData: 
   { foo: 
      { value: 'Hello World',
        options: { filename: 'hello.txt', contentType: 'text/plain' } } } };

request(options, function (error, response, body) {
  if (error) throw new Error(error);

  console.log(body);
});

