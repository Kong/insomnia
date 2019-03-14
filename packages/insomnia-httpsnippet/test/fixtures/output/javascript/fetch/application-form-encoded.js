const fetchOptions = {
  mode: 'cors',
  method: 'POST',
  headers: {
    'content-type': 'application/x-www-form-urlencoded',
  },
  body: {
    foo: 'bar',
    hello: 'world',
  },
};

fetch('http://mockbin.com/har', fetchOptions)
  .then(response => response.json())
  .then(data => console.log(data));
