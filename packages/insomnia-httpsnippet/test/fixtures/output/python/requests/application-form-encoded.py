import requests

url = "http://mockbin.com/har"

payload = "foo=bar&hello=world"
headers = {'content-type': 'application/x-www-form-urlencoded'}

response = requests.request("POST", url, data=payload, headers=headers)

print(response.text)
