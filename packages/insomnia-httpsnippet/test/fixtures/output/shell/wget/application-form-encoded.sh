wget --quiet \
  --method POST \
  --header 'content-type: application/x-www-form-urlencoded' \
  --body-data 'foo=bar&hello=world' \
  --output-document \
  - http://mockbin.com/har
