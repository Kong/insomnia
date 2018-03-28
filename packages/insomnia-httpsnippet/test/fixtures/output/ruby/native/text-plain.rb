require 'uri'
require 'net/http'

url = URI("http://mockbin.com/har")

http = Net::HTTP.new(url.host, url.port)

request = Net::HTTP::Post.new(url)
request["content-type"] = 'text/plain'
request.body = "Hello World"

response = http.request(request)
puts response.read_body
