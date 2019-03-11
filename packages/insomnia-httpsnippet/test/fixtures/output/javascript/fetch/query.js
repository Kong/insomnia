const fetchOptions = {
  mode: 'cors',
  method: 'GET',
  headers: {},
};

fetch('http://mockbin.com/har?foo=bar&foo=baz&baz=abc&key=value', fetchOptions)
  .then(response => response.json())
  .then(data => console.log(data));
