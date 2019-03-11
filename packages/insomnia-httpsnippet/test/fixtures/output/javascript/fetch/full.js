const fetchOptions = {
  mode: 'cors',
  method: 'POST',
  headers: {
    cookie: 'foo=bar; bar=baz',
    accept: 'application/json',
    'content-type': 'application/x-www-form-urlencoded',
  },
  body: {
    foo: 'bar',
  },
};

fetch('http://mockbin.com/har?foo=bar&foo=baz&baz=abc&key=value', fetchOptions)
  .then(response => response.json())
  .then(data => console.log(data));
