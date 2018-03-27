var client = new RestClient("http://mockbin.com/har?foo=bar&foo=baz&baz=abc&key=value");
var request = new RestRequest(Method.POST);
request.AddHeader("content-type", "application/x-www-form-urlencoded");
request.AddHeader("accept", "application/json");
request.AddCookie("foo", "bar");
request.AddCookie("bar", "baz");
request.AddParameter("application/x-www-form-urlencoded", "foo=bar", ParameterType.RequestBody);
IRestResponse response = client.Execute(request);
