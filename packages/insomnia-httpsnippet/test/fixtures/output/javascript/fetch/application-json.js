const fetchOptions = {
  mode: 'cors',
  method: 'POST',
  headers: {
    'content-type': 'application/json',
  },
  body:
    '{"number":1,"string":"f\\"oo","arr":[1,2,3],"nested":{"a":"b"},"arr_mix":[1,"a",{"arr_mix_nested":{}}],"boolean":false}',
};

fetch('http://mockbin.com/har', fetchOptions)
  .then(response => response.json())
  .then(data => console.log(data));
