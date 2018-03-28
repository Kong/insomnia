wget --quiet \
  --method POST \
  --header 'content-type: application/json' \
  --body-data '{"number":1,"string":"f\"oo","arr":[1,2,3],"nested":{"a":"b"},"arr_mix":[1,"a",{"arr_mix_nested":{}}],"boolean":false}' \
  --output-document \
  - http://mockbin.com/har
