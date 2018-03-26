var client = new RestClient("https://mockbin.com/har");
var request = new RestRequest(Method.GET);
IRestResponse response = client.Execute(request);
