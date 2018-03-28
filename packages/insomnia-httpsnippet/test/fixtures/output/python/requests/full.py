import requests

url = "http://mockbin.com/har"

querystring = {"foo":["bar","baz"],"baz":"abc","key":"value"}

payload = "foo=bar"
headers = {
    'cookie': "foo=bar; bar=baz",
    'accept': "application/json",
    'content-type': "application/x-www-form-urlencoded"
    }

response = requests.request("POST", url, data=payload, headers=headers, params=querystring)

print(response.text)
