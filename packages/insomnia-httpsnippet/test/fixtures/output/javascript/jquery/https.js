var settings = {
  "async": true,
  "crossDomain": true,
  "url": "https://mockbin.com/har",
  "method": "GET",
  "headers": {}
}

$.ajax(settings).done(function (response) {
  console.log(response);
});
