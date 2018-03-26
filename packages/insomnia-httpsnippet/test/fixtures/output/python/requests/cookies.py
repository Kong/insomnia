import requests

url = "http://mockbin.com/har"

headers = {'cookie': 'foo=bar; bar=baz'}

response = requests.request("POST", url, headers=headers)

print(response.text)
