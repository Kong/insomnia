OkHttpClient client = new OkHttpClient();

Request request = new Request.Builder()
  .url("http://mockbin.com/har")
  .get()
  .addHeader("accept", "application/json")
  .addHeader("x-foo", "Bar")
  .build();

Response response = client.newCall(request).execute();
