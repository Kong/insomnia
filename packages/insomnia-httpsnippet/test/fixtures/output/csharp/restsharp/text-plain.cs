var client = new RestClient("http://mockbin.com/har");
var request = new RestRequest(Method.POST);
request.AddHeader("content-type", "text/plain");
request.AddParameter("text/plain", "Hello World", ParameterType.RequestBody);
IRestResponse response = client.Execute(request);
