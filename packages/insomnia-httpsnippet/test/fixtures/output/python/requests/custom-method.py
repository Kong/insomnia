import requests

url = "http://mockbin.com/har"

response = requests.request("PROPFIND", url)

print(response.text)
