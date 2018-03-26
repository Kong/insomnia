require 'uri'
require 'net/http'

url = URI("http://mockbin.com/har?foo=bar&foo=baz&baz=abc&key=value")

http = Net::HTTP.new(url.host, url.port)

request = Net::HTTP::Post.new(url)
request["cookie"] = 'foo=bar; bar=baz'
request["accept"] = 'application/json'
request["content-type"] = 'application/x-www-form-urlencoded'
request.body = "foo=bar"

response = http.request(request)
puts response.read_body
