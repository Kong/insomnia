var client = new RestClient("http://mockbin.com/har");
var request = new RestRequest(Method.GET);
request.AddHeader("x-foo", "Bar");
request.AddHeader("accept", "application/json");
IRestResponse response = client.Execute(request);
