import http.client

conn = http.client.HTTPConnection("mockbin.com")

payload = "Hello World"

headers = { 'content-type': "text/plain" }

conn.request("POST", "/har", payload, headers)

res = conn.getresponse()
data = res.read()

print(data.decode("utf-8"))
