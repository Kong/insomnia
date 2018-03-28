import requests

url = "http://mockbin.com/har"

payload = "-----011000010111000001101001\r\nContent-Disposition: form-data; name=\"foo\"; filename=\"hello.txt\"\r\nContent-Type: text/plain\r\n\r\nHello World\r\n-----011000010111000001101001--\r\n"
headers = {'content-type': 'multipart/form-data; boundary=---011000010111000001101001'}

response = requests.request("POST", url, data=payload, headers=headers)

print(response.text)
