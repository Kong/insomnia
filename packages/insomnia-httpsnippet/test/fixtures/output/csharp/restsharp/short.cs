var client = new RestClient("http://mockbin.com/har");
var request = new RestRequest(Method.GET);
IRestResponse response = client.Execute(request);
