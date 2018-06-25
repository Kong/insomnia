var settings = {
  async: true,
  crossDomain: true,
  url: 'http://mockbin.com/har',
  method: 'POST',
  headers: {
    'content-type': 'application/json'
  },
  processData: false,
  data:
    '{"number":1,"string":"f\\"oo","arr":[1,2,3],"nested":{"a":"b"},"arr_mix":[1,"a",{"arr_mix_nested":{}}],"boolean":false}'
};

$.ajax(settings).done(function(response) {
  console.log(response);
});
