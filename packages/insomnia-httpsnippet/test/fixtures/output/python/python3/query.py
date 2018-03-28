import http.client

conn = http.client.HTTPConnection("mockbin.com")

conn.request("GET", "/har?foo=bar&foo=baz&baz=abc&key=value")

res = conn.getresponse()
data = res.read()

print(data.decode("utf-8"))
