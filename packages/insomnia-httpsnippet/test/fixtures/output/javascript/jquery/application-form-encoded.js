var settings = {
  async: true,
  crossDomain: true,
  url: 'http://mockbin.com/har',
  method: 'POST',
  headers: {
    'content-type': 'application/x-www-form-urlencoded',
  },
  data: {
    foo: 'bar',
    hello: 'world',
  },
};

$.ajax(settings).done(function(response) {
  console.log(response);
});
