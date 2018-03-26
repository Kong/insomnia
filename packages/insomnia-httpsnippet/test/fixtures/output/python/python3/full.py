import http.client

conn = http.client.HTTPConnection("mockbin.com")

payload = "foo=bar"

headers = {
    'cookie': "foo=bar; bar=baz",
    'accept': "application/json",
    'content-type': "application/x-www-form-urlencoded"
    }

conn.request("POST", "/har?foo=bar&foo=baz&baz=abc&key=value", payload, headers)

res = conn.getresponse()
data = res.read()

print(data.decode("utf-8"))
