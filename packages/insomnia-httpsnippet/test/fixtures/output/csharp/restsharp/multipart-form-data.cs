var client = new RestClient("http://mockbin.com/har");
var request = new RestRequest(Method.POST);
request.AddHeader("content-type", "multipart/form-data; boundary=---011000010111000001101001");
request.AddParameter("multipart/form-data; boundary=---011000010111000001101001", "-----011000010111000001101001\r\nContent-Disposition: form-data; name=\"foo\"\r\n\r\nbar\r\n-----011000010111000001101001--\r\n", ParameterType.RequestBody);
IRestResponse response = client.Execute(request);
