HttpResponse<String> response = Unirest.post("http://mockbin.com/har")
  .header("content-type", "text/plain")
  .body("Hello World")
  .asString();
