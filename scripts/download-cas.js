const https = require('https');
const fs = require('fs');

const file = fs.createWriteStream();
https.get('https://curl.haxx.se/ca/cacert.pem', res => {
  res.pipe(file);
});

https.get('https://curl.haxx.se/ca/cacert.pem');
