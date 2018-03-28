import http.client

conn = http.client.HTTPConnection("mockbin.com")

payload = "-----011000010111000001101001\r\nContent-Disposition: form-data; name=\"foo\"; filename=\"hello.txt\"\r\nContent-Type: text/plain\r\n\r\nHello World\r\n-----011000010111000001101001--\r\n"

headers = { 'content-type': "multipart/form-data; boundary=---011000010111000001101001" }

conn.request("POST", "/har", payload, headers)

res = conn.getresponse()
data = res.read()

print(data.decode("utf-8"))
