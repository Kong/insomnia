import requests

url = "https://mockbin.com/har"

response = requests.request("GET", url)

print(response.text)
