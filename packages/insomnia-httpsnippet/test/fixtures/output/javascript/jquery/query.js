var settings = {
  "async": true,
  "crossDomain": true,
  "url": "http://mockbin.com/har?foo=bar&foo=baz&baz=abc&key=value",
  "method": "GET",
  "headers": {}
}

$.ajax(settings).done(function (response) {
  console.log(response);
});
