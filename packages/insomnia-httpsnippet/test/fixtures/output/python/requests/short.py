import requests

url = "http://mockbin.com/har"

response = requests.request("GET", url)

print(response.text)
