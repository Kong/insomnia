echo '{"number":1,"string":"f\"oo","arr":[1,2,3],"nested":{"a":"b"},"arr_mix":[1,"a",{"arr_mix_nested":{}}],"boolean":false}' |  \
  http POST http://mockbin.com/har \
  content-type:application/json
