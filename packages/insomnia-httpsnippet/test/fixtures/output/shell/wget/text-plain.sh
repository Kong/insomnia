wget --quiet \
  --method POST \
  --header 'content-type: text/plain' \
  --body-data 'Hello World' \
  --output-document \
  - http://mockbin.com/har
