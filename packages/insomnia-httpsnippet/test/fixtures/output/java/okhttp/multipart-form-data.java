OkHttpClient client = new OkHttpClient();

MediaType mediaType = MediaType.parse("multipart/form-data; boundary=---011000010111000001101001");
RequestBody body = RequestBody.create(mediaType, "-----011000010111000001101001\r\nContent-Disposition: form-data; name=\"foo\"\r\n\r\nbar\r\n-----011000010111000001101001--\r\n");
Request request = new Request.Builder()
  .url("http://mockbin.com/har")
  .post(body)
  .addHeader("content-type", "multipart/form-data; boundary=---011000010111000001101001")
  .build();

Response response = client.newCall(request).execute();
