var settings = {
  async: true,
  crossDomain: true,
  url: 'http://mockbin.com/har',
  method: 'PROPFIND',
  headers: {}
};

$.ajax(settings).done(function(response) {
  console.log(response);
});
