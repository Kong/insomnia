OkHttpClient client = new OkHttpClient();

Request request = new Request.Builder()
  .url("http://mockbin.com/har")
  .method("PROPFIND", null)
  .build();

Response response = client.newCall(request).execute();
