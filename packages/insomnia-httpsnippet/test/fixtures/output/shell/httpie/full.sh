http --form POST 'http://mockbin.com/har?foo=bar&foo=baz&baz=abc&key=value' \
  accept:application/json \
  content-type:application/x-www-form-urlencoded \
  cookie:'foo=bar; bar=baz' \
  foo=bar
