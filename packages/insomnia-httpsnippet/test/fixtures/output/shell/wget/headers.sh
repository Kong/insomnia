wget --quiet \
  --method GET \
  --header 'accept: application/json' \
  --header 'x-foo: Bar' \
  --output-document \
  - http://mockbin.com/har
