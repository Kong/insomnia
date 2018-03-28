HttpResponse<String> response = Unirest.get("http://mockbin.com/har?foo=bar&foo=baz&baz=abc&key=value")
  .asString();
