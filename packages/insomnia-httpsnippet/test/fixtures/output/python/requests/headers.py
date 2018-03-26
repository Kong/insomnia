import requests

url = "http://mockbin.com/har"

headers = {
    'accept': "application/json",
    'x-foo': "Bar"
    }

response = requests.request("GET", url, headers=headers)

print(response.text)
