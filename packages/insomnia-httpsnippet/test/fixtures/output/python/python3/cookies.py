import http.client

conn = http.client.HTTPConnection("mockbin.com")

headers = { 'cookie': "foo=bar; bar=baz" }

conn.request("POST", "/har", headers=headers)

res = conn.getresponse()
data = res.read()

print(data.decode("utf-8"))
