HttpResponse<String> response = Unirest.post("http://mockbin.com/har?foo=bar&foo=baz&baz=abc&key=value")
  .header("cookie", "foo=bar; bar=baz")
  .header("accept", "application/json")
  .header("content-type", "application/x-www-form-urlencoded")
  .body("foo=bar")
  .asString();
