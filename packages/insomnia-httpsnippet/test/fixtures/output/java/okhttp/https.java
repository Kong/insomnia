OkHttpClient client = new OkHttpClient();

Request request = new Request.Builder()
  .url("https://mockbin.com/har")
  .get()
  .build();

Response response = client.newCall(request).execute();
