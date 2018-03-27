HttpResponse<String> response = Unirest.post("http://mockbin.com/har")
  .header("content-type", "application/json")
  .body("{\"number\":1,\"string\":\"f\\\"oo\",\"arr\":[1,2,3],\"nested\":{\"a\":\"b\"},\"arr_mix\":[1,\"a\",{\"arr_mix_nested\":{}}],\"boolean\":false}")
  .asString();
