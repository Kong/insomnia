curl --request POST \
  --url http://mockbin.com/har \
  --header 'content-type: multipart/form-data; boundary=---011000010111000001101001' \
  --form foo=@test/fixtures/files/hello.txt
