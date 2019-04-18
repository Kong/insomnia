const fetchOptions = {
  mode: 'cors',
  method: 'GET',
  headers: {
    accept: 'application/json',
    'x-foo': 'Bar',
  },
};

fetch('http://mockbin.com/har', fetchOptions)
  .then(response => response.json())
  .then(data => console.log(data));
