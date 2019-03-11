const fetchOptions = {
  mode: 'cors',
  method: 'POST',
  headers: {
    cookie: 'foo=bar; bar=baz',
  },
};

fetch('http://mockbin.com/har', fetchOptions)
  .then(response => response.json())
  .then(data => console.log(data));
