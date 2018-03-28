import http.client

conn = http.client.HTTPConnection("mockbin.com")

conn.request("GET", "/har")

res = conn.getresponse()
data = res.read()

print(data.decode("utf-8"))
