curl \
  --request POST \
  -i \
  --url http://localhost:8000/api/v1/send \
  --header 'x-custom-header :foo bar' \
  --header 'content-type: application/json' \
  --header 'Cookie: foo=bar' \
  --user 'My User:My:Secret:Password' \
  --cookie NID=91=iOf1sU9Ovlns9Dzn2Ipz05syr2K4AlZ4Kgp84eRVLf3_6DgcNrkqpWg4lfUvCB5cNxD26t \
  -H 'another-header: foo' \
  --data '{"email_id": "tem_123"}';

