var client = new RestClient("http://mockbin.com/har?foo=bar&foo=baz&baz=abc&key=value");
var request = new RestRequest(Method.GET);
IRestResponse response = client.Execute(request);
