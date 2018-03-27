var settings = {
  "async": true,
  "crossDomain": true,
  "url": "http://mockbin.com/har",
  "method": "POST",
  "headers": {
    "content-type": "text/plain"
  },
  "data": "Hello World"
}

$.ajax(settings).done(function (response) {
  console.log(response);
});
