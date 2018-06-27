var settings = {
  async: true,
  crossDomain: true,
  url: 'http://mockbin.com/har?foo=bar&foo=baz&baz=abc&key=value',
  method: 'POST',
  headers: {
    cookie: 'foo=bar; bar=baz',
    accept: 'application/json',
    'content-type': 'application/x-www-form-urlencoded'
  },
  data: {
    foo: 'bar'
  }
};

$.ajax(settings).done(function(response) {
  console.log(response);
});
