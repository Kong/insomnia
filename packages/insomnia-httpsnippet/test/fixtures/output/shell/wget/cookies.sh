wget --quiet \
  --method POST \
  --header 'cookie: foo=bar; bar=baz' \
  --output-document \
  - http://mockbin.com/har
