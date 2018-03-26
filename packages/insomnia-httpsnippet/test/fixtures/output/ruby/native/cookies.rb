require 'uri'
require 'net/http'

url = URI("http://mockbin.com/har")

http = Net::HTTP.new(url.host, url.port)

request = Net::HTTP::Post.new(url)
request["cookie"] = 'foo=bar; bar=baz'

response = http.request(request)
puts response.read_body
