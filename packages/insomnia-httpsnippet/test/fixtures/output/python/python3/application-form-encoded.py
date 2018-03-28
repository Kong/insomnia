import http.client

conn = http.client.HTTPConnection("mockbin.com")

payload = "foo=bar&hello=world"

headers = { 'content-type': "application/x-www-form-urlencoded" }

conn.request("POST", "/har", payload, headers)

res = conn.getresponse()
data = res.read()

print(data.decode("utf-8"))
