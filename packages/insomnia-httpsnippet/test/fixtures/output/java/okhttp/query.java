OkHttpClient client = new OkHttpClient();

Request request = new Request.Builder()
  .url("http://mockbin.com/har?foo=bar&foo=baz&baz=abc&key=value")
  .get()
  .build();

Response response = client.newCall(request).execute();
