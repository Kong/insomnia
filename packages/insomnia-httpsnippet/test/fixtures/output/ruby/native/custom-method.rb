require 'uri'
require 'net/http'

class Net::HTTP::Propfind < Net::HTTPRequest
  METHOD = 'PROPFIND'
  REQUEST_HAS_BODY = 'false'
  RESPONSE_HAS_BODY = true
end

url = URI("http://mockbin.com/har")

http = Net::HTTP.new(url.host, url.port)

request = Net::HTTP::Propfind.new(url)

response = http.request(request)
puts response.read_body
