var client = new RestClient("http://mockbin.com/har");
var request = new RestRequest(Method.POST);
request.AddCookie("foo", "bar");
request.AddCookie("bar", "baz");
IRestResponse response = client.Execute(request);
